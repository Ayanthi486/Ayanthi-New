import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { KpiRow } from './KpiRow';

describe('KpiRow', () => {
  it('renders each figure from the response it was given', () => {
    render(<KpiRow kpis={{ total: 7, pending: 4, completed: 2, cancelled: 1 }} />);

    expect(screen.getByText('Total').nextSibling).toHaveTextContent('7');
    expect(screen.getByText('Pending').nextSibling).toHaveTextContent('4');
    expect(screen.getByText('Completed').nextSibling).toHaveTextContent('2');
    expect(screen.getByText('Cancelled').nextSibling).toHaveTextContent('1');
  });
});
