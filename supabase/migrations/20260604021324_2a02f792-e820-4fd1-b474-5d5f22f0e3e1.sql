
REVOKE EXECUTE ON FUNCTION public.promote_from_waitlist(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.mark_no_shows(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.admin_set_tournament_status(uuid, tournament_status) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.assign_waitlist_position() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.trg_auto_promote_waitlist() FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.promote_from_waitlist(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mark_no_shows(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_set_tournament_status(uuid, tournament_status) TO authenticated;
