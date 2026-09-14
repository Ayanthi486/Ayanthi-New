const fs = require('fs');
let file = fs.readFileSync('apps/web/src/features/documents/components/DocumentsSection.tsx', 'utf8');

// Update ATTACHMENTS usage
file = file.replace(
  `content = <AttachmentsTab shipmentId={shipmentId} />;`,
  `content = <AttachmentsTab shipmentId={shipmentId} category="OTHER" accept="application/pdf,image/jpeg,image/png" description="Supporting files for this shipment — customs forms, correspondence, scans (PDF, JPEG or PNG)." />;`
);

// Update UPLOAD_DOCUMENT_TYPES routing
file = file.replace(
  `    content = (UPLOAD_DOCUMENT_TYPES as readonly DocumentType[]).includes(activeTab) ? (
      <UploadDocumentTab key={activeTab} shipmentId={shipmentId} type={activeTab} />
    ) : (
      <DocumentTab key={activeTab} shipmentId={shipmentId} type={activeTab} />
    );`,
  `    content = (UPLOAD_DOCUMENT_TYPES as readonly DocumentType[]).includes(activeTab) ? (
      <AttachmentsTab key={activeTab} shipmentId={shipmentId} category={activeTab} accept="application/pdf,image/jpeg,image/png" description={\`Upload \${DOCUMENT_TAB_LABELS[activeTab as DocumentType]} files and pictures (PDF, JPEG or PNG).\`} />
    ) : (
      <DocumentTab key={activeTab} shipmentId={shipmentId} type={activeTab as DocumentType} />
    );`
);

fs.writeFileSync('apps/web/src/features/documents/components/DocumentsSection.tsx', file);
