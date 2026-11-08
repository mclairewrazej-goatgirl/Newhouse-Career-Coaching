/**
 * Api.gs — doGet/doPost router. Parses {action, token, payload}, checks the
 * token for every action except login and ping, and returns
 * {ok:true, data} or {ok:false, error:{code, message}}.
 * Filled in during Phase 1.
 */
