<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::statement(<<<'SQL'
            WITH allocation_totals AS (
                SELECT quotation_id, COALESCE(SUM(amount), 0) AS gross_received
                FROM payment_allocations
                WHERE deleted_at IS NULL
                GROUP BY quotation_id
            ),
            refund_totals AS (
                SELECT
                    quotation_id,
                    COALESCE(SUM(amount) FILTER (WHERE refund_type IN ('deposit', 'payment')), 0) AS refunded,
                    COALESCE(SUM(amount) FILTER (WHERE refund_type = 'deposit'), 0) AS deposit_refunded
                FROM payment_refunds
                WHERE deleted_at IS NULL
                  AND status = 'completed'
                  AND quotation_id IS NOT NULL
                GROUP BY quotation_id
            ),
            quotation_collection AS (
                SELECT
                    quotations.id,
                    quotations.total_amount,
                    CASE
                        WHEN quotations.metadata->>'depositMode' = 'non_taxable_addition_v1'
                            OR (
                                COALESCE(quotations.deposit_amount, 0) > 0
                                AND ABS(
                                    quotations.total_amount
                                        - (
                                            quotations.subtotal_amount
                                            + quotations.vat_amount
                                            + quotations.deposit_amount
                                        )
                                ) < 0.01
                            )
                            THEN COALESCE(quotations.deposit_amount, 0)
                        ELSE 0
                    END AS deposit_amount,
                    COALESCE(allocation_totals.gross_received, 0) AS gross_received,
                    COALESCE(refund_totals.refunded, 0) AS refunded,
                    COALESCE(refund_totals.deposit_refunded, 0) AS deposit_refunded,
                    GREATEST(
                        0,
                        COALESCE(allocation_totals.gross_received, 0) - COALESCE(refund_totals.refunded, 0)
                    ) AS net_received
                FROM quotations
                LEFT JOIN allocation_totals ON allocation_totals.quotation_id = quotations.id
                LEFT JOIN refund_totals ON refund_totals.quotation_id = quotations.id
                WHERE quotations.deleted_at IS NULL
            )
            UPDATE quotations
            SET status = CASE
                    WHEN quotation_collection.gross_received > 0.01
                        AND quotation_collection.net_received <= 0.01
                        AND quotation_collection.refunded >= quotation_collection.gross_received - 0.01
                        THEN 'refunded'
                    WHEN GREATEST(
                            0,
                            quotation_collection.total_amount
                                - LEAST(quotation_collection.deposit_amount, quotation_collection.deposit_refunded)
                        ) > 0.01
                        AND quotation_collection.net_received >= GREATEST(
                            0,
                            quotation_collection.total_amount
                                - LEAST(quotation_collection.deposit_amount, quotation_collection.deposit_refunded)
                        ) - 0.01
                        THEN 'won'
                    ELSE 'draft'
                END,
                updated_at = NOW()
            FROM quotation_collection
            WHERE quotations.id = quotation_collection.id
            SQL);
    }

    public function down(): void
    {
        DB::statement(<<<'SQL'
            WITH allocation_totals AS (
                SELECT quotation_id, COALESCE(SUM(amount), 0) AS gross_received
                FROM payment_allocations
                WHERE deleted_at IS NULL
                GROUP BY quotation_id
            ),
            refund_totals AS (
                SELECT quotation_id, COALESCE(SUM(amount), 0) AS refunded
                FROM payment_refunds
                WHERE deleted_at IS NULL
                  AND status = 'completed'
                  AND refund_type IN ('deposit', 'payment')
                  AND quotation_id IS NOT NULL
                GROUP BY quotation_id
            )
            UPDATE quotations
            SET status = CASE
                    WHEN quotations.total_amount > 0.01
                        AND GREATEST(
                            0,
                            COALESCE(allocation_totals.gross_received, 0) - COALESCE(refund_totals.refunded, 0)
                        ) >= quotations.total_amount - 0.01
                        THEN 'won'
                    ELSE 'draft'
                END,
                updated_at = NOW()
            FROM allocation_totals
            LEFT JOIN refund_totals ON refund_totals.quotation_id = allocation_totals.quotation_id
            WHERE quotations.id = allocation_totals.quotation_id
              AND quotations.deleted_at IS NULL
            SQL);
    }
};
