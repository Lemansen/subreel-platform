-- Cover the audit log's actor foreign key while supporting actor-based history queries.
create index if not exists catalog_audit_log_actor_created_idx
 on public.catalog_audit_log(actor_id, created_at desc)
 where actor_id is not null;
