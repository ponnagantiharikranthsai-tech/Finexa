CREATE INDEX "idx_borrowers_aadhaar" ON "borrowers" USING btree ("aadhaar_encrypted");--> statement-breakpoint
CREATE INDEX "idx_loans_status" ON "loans" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_loans_due_date" ON "loans" USING btree ("due_date");--> statement-breakpoint
CREATE INDEX "idx_loans_borrower_id" ON "loans" USING btree ("borrower_id");--> statement-breakpoint
CREATE INDEX "idx_loans_status_due_date" ON "loans" USING btree ("status","due_date");--> statement-breakpoint
CREATE INDEX "idx_loans_active_due_date" ON "loans" USING btree ("due_date") WHERE status IN ('active', 'overdue', 'extended');--> statement-breakpoint
CREATE INDEX "idx_payments_loan_id" ON "payments" USING btree ("loan_id");--> statement-breakpoint
CREATE INDEX "idx_payments_payment_date" ON "payments" USING btree ("payment_date");--> statement-breakpoint
CREATE INDEX "idx_notifications_loan_id_type" ON "notifications_log" USING btree ("loan_id","type");--> statement-breakpoint
CREATE INDEX "idx_notifications_sent_at" ON "notifications_log" USING btree ("sent_at");--> statement-breakpoint
CREATE INDEX "idx_audit_log_timestamp" ON "audit_log" USING btree ("timestamp");--> statement-breakpoint
CREATE INDEX "idx_audit_log_entity_id" ON "audit_log" USING btree ("entity_id");--> statement-breakpoint
CREATE INDEX "idx_audit_log_loan_id" ON "audit_log" USING btree ("loan_id");