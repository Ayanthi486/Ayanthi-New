import { Injectable } from '@nestjs/common';
import type { Payment, PaymentListResponse, RecordPaymentRequest } from '@hub-lanka/shared';
import { AuditService } from '../audit/audit.service';
import { BusinessRuleError, ForbiddenError, NotFoundError } from '../common/errors/app-error';
import { Prisma } from '../generated/prisma/client';
import { PermissionsService } from '../identity/permissions.service';
import type { RequestUser } from '../identity/types';
import { computeTotals } from '../invoice/invoice.util';
import { PrismaService } from '../prisma/prisma.service';
import { parseDateOnly } from '../shipment/shipment.util';
import { StorageService } from '../storage/storage.service';
import { extensionForKind, validateFileKind } from '../storage/storage.util';
import { computePaymentSummary, computeUsdEquivalent, toSharedPayment } from './payment.util';

export interface UploadedReceipt {
  buffer: Buffer;
  mimetype: string;
  originalname: string;
}

const INVOICE_WITH_LINES_AND_PAYMENTS = {
  lines: true,
  payments: { orderBy: { createdAt: 'asc' as const } },
} as const;

/**
 * Payment (Phase 6, PRD §5.4/§6, CONTEXT.md §14). Manager records against an
 * Issued invoice; Director views. BR-28/54/55/56/57 — a payment is never
 * edited or deleted once recorded (DEVELOPMENT_RULES §5).
 */
@Injectable()
export class PaymentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly permissionsService: PermissionsService,
    private readonly storage: StorageService,
  ) {}

  async record(
    invoiceId: string,
    input: RecordPaymentRequest,
    receipt: UploadedReceipt | undefined,
    idempotencyKey: string | null,
    actor: RequestUser,
  ): Promise<Payment> {
    // Idempotent replay: a retried double-click with the same key returns
    // the already-recorded payment before doing any further work.
    if (idempotencyKey) {
      const existing = await this.prisma.payment.findUnique({ where: { idempotencyKey } });
      if (existing) return toSharedPayment(existing);
    }

    let receiptSave: { key: string; contentType: string; originalFilename: string } | undefined;
    if (receipt) {
      const kind = validateFileKind(receipt.mimetype, receipt.buffer);
      if (!kind) {
        throw new BusinessRuleError(
          'Receipt must be a PDF, JPEG or PNG file matching its declared type',
        );
      }
      const saved = await this.storage.save({
        buffer: receipt.buffer,
        prefix: 'payments',
        extension: extensionForKind(kind),
      });
      receiptSave = {
        key: saved.key,
        contentType: receipt.mimetype,
        originalFilename: receipt.originalname,
      };
    }

    try {
      const created = await this.auditService.auditedTransaction(
        this.prisma,
        { userId: actor.id, ipAddress: null, userAgent: null },
        async (tx) => {
          const invoice = await tx.invoice.findUnique({
            where: { id: invoiceId },
            include: INVOICE_WITH_LINES_AND_PAYMENTS,
          });
          if (!invoice) throw new NotFoundError('Invoice not found');
          // Decision #4: CONTEXT.md §14's own diagram — "Invoice issued (Manager) -> partial payment(s)".
          if (invoice.status !== 'ISSUED') {
            throw new BusinessRuleError('Payments can only be recorded against an Issued invoice');
          }

          const { totalUsd } = computeTotals(invoice.lines);
          const newUsdEquivalent = computeUsdEquivalent(
            input.amount,
            input.currency,
            invoice.exchangeRate,
          );
          const existingSummary = computePaymentSummary(
            totalUsd,
            invoice.payments,
            invoice.exchangeRate,
          );
          const projectedPaid = new Prisma.Decimal(existingSummary.paidUsd).plus(newUsdEquivalent);
          // Decision #3: DEVELOPMENT_PLAN.md's explicit Phase 6 guard, built against
          // PRD §7's [INFERRED] over-payment rule (see the Phase 6 report).
          if (projectedPaid.greaterThan(totalUsd)) {
            throw new BusinessRuleError(
              'This payment would exceed the invoice total. Remaining balance: ' +
                existingSummary.remainingUsd +
                ' USD',
            );
          }

          return tx.payment.create({
            data: {
              invoiceId,
              amount: input.amount,
              currency: input.currency,
              paymentDate: parseDateOnly(input.paymentDate),
              method: input.method ?? null,
              reference: input.reference ?? null,
              receiptStorageKey: receiptSave?.key ?? null,
              receiptOriginalFilename: receiptSave?.originalFilename ?? null,
              receiptContentType: receiptSave?.contentType ?? null,
              idempotencyKey,
              recordedByUserId: actor.id,
            },
          });
        },
      );

      return toSharedPayment(created);
    } catch (error) {
      // Decision #6: a genuine concurrent replay (two identical requests racing) can
      // both pass the pre-check above; the DB's unique constraint on idempotencyKey
      // is the real guard — the loser lands here and returns the winner's row
      // instead of surfacing a raw conflict. (A file uploaded by the loser is
      // orphaned on disk in this rare race — an accepted, minor imperfection.)
      if (
        idempotencyKey &&
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        const existing = await this.prisma.payment.findUniqueOrThrow({ where: { idempotencyKey } });
        return toSharedPayment(existing);
      }
      throw error;
    }
  }

  async listByInvoice(invoiceId: string, actor: RequestUser): Promise<PaymentListResponse> {
    await this.checkViewPermission(actor);

    const invoice = await this.prisma.invoice.findUnique({
      where: { id: invoiceId },
      include: INVOICE_WITH_LINES_AND_PAYMENTS,
    });
    if (!invoice) throw new NotFoundError('Invoice not found');

    const { totalUsd } = computeTotals(invoice.lines);
    const summary = computePaymentSummary(totalUsd, invoice.payments, invoice.exchangeRate);

    return {
      payments: invoice.payments.map(toSharedPayment),
      summary,
    };
  }

  async getReceipt(
    paymentId: string,
    actor: RequestUser,
  ): Promise<{ buffer: Buffer; contentType: string; filename: string }> {
    await this.checkViewPermission(actor);

    const payment = await this.prisma.payment.findUnique({ where: { id: paymentId } });
    if (!payment) throw new NotFoundError('Payment not found');
    if (!payment.receiptStorageKey) throw new NotFoundError('This payment has no receipt');

    const buffer = await this.storage.read(payment.receiptStorageKey);
    return {
      buffer,
      contentType: payment.receiptContentType ?? 'application/octet-stream',
      filename: payment.receiptOriginalFilename ?? 'receipt',
    };
  }

  /** Decision mirrors InvoiceService#checkViewPermission — payment.view (Manager) and payment.view.readonly (Director) are a genuine either/or. */
  private async checkViewPermission(actor: RequestUser): Promise<void> {
    const [canView, canViewReadonly] = await Promise.all([
      this.permissionsService.hasPermission(actor.id, 'payment.view'),
      this.permissionsService.hasPermission(actor.id, 'payment.view.readonly'),
    ]);
    if (!canView && !canViewReadonly) {
      throw new ForbiddenError('Missing permission: payment.view or payment.view.readonly');
    }
  }
}
