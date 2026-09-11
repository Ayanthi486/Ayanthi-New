import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { KpiRow } from './KpiRow';

describe('KpiRow', () => {
  it('renders each figure from the response it was given', () => {
    render(
      <KpiRow
        kpis={{
          total: 15,
          pending: 4,
          confirmed: 3,
          cancelled: 1,
          departed: 2,
          paymentPending: 3,
          paymentReceived: 2,
        }}
      />,
    );

    expect(screen.getByText('Total').nextSibling).toHaveTextContent('15');
    expect(screen.getByText('Pending').nextSibling).toHaveTextContent('4');
    expect(screen.getByText('Confirmed').nextSibling).toHaveTextContent('3');
    expect(screen.getByText('Cancelled').nextSibling).toHaveTextContent('1');
    expect(screen.getByText('Departed').nextSibling).toHaveTextContent('2');
    expect(screen.getByText('Payment Pending').nextSibling).toHaveTextContent('3');
    expect(screen.getByText('Payment Received').nextSibling).toHaveTextContent('2');
  });
});
