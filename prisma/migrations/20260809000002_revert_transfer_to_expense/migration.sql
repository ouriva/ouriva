-- Data fix: revert incorrectly migrated TRANSFER transactions back to EXPENSE.
-- The previous migration (20260809000001) reclassified all "Transferência de Conta"
-- transactions as TRANSFER. This was incorrect — those were expense transactions
-- and should remain EXPENSE. categoryId stays NULL; users will reassign manually.
UPDATE "Transaction"
SET "type" = 'EXPENSE'
WHERE "type" = 'TRANSFER';
