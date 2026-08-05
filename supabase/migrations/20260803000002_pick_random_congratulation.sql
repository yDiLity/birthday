-- Атомарный выбор случайного поздравления без повторов (pool без повторов, C3).
-- Выбор и обновление used_ids выполняются в одной транзакции; advisory-лок
-- по user_id исключает гонку при параллельных запусках cron.
-- Если весь пул использован — начинается новый цикл с любого поздравления.
-- Из браузера (authenticated) всегда берётся auth.uid(), поэтому чужой user_id
-- передать нельзя; из сервера (service_role, без JWT) используется p_user_id.

CREATE OR REPLACE FUNCTION public.pick_random_congratulation(p_user_id uuid)
RETURNS TABLE (id uuid, text text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid;
  v_used uuid[];
  v_pick congratulations%ROWTYPE;
BEGIN
  v_user := COALESCE(auth.uid(), p_user_id);
  IF v_user IS NULL THEN
    RETURN;
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext(v_user::text)::bigint);

  SELECT used_ids INTO v_used
  FROM public.congratulations_usage
  WHERE user_id = v_user;

  IF v_used IS NULL THEN
    v_used := ARRAY[]::uuid[];
  END IF;

  SELECT * INTO v_pick
  FROM public.congratulations
  WHERE user_id = v_user
    AND NOT (id = ANY(v_used))
  ORDER BY random()
  LIMIT 1;

  IF v_pick.id IS NULL THEN
    -- Весь пул использован — начинаем новый цикл.
    SELECT * INTO v_pick
    FROM public.congratulations
    WHERE user_id = v_user
    ORDER BY random()
    LIMIT 1;

    IF v_pick.id IS NULL THEN
      -- У пользователя ещё нет поздравлений (сидятся на клиенте/в route).
      RETURN;
    END IF;

    v_used := ARRAY[v_pick.id]::uuid[];
  ELSE
    v_used := array_append(v_used, v_pick.id);
  END IF;

  INSERT INTO public.congratulations_usage (user_id, used_ids, updated_at)
  VALUES (v_user, v_used, NOW())
  ON CONFLICT (user_id)
  DO UPDATE SET used_ids = EXCLUDED.used_ids, updated_at = NOW();

  id := v_pick.id;
  text := v_pick.text;
  RETURN NEXT;
END;
$$;

REVOKE ALL ON FUNCTION public.pick_random_congratulation(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.pick_random_congratulation(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.pick_random_congratulation(uuid) TO service_role;
