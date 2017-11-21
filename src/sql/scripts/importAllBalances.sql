-- create all address rows
INSERT INTO balance (address_id) SELECT address_id FROM address ON CONFLICT DO NOTHING;

-- Stop autovacuum for the cluster
ALTER SYSTEM SET autovacuum = off;
SELECT * from pg_reload_conf();

--select * from pg_settings where name like 'autovacuum%';

-- vout count, vout value
UPDATE
  balance
SET
  vout = sq.vout_value,
  vout_count = sq.vout_count
FROM (
  SELECT
    a.address_id,
    coalesce(count(DISTINCT vout.vout_id), 0) AS vout_count,
    coalesce(sum(coalesce(vout.value, 0)), 0) AS vout_value
  FROM
    address a
  JOIN
    vout_address va ON va.address_id = a.address_id
  JOIN
    vout ON vout.vout_id = va.vout_id
  GROUP BY
    a.address_id
) AS sq
WHERE
  balance.address_id = sq.address_id;

-- vin count, vin amountin
UPDATE
  balance
SET
  vin = sq.vin_amountin,
  vin_count = sq.vin_count
FROM (
  SELECT
    a.address_id,
    coalesce(count(DISTINCT vin.vin_id), 0) AS vin_count,
    coalesce(sum(coalesce(vin.amountin, 0)), 0) AS vin_amountin
  FROM
    address a
  JOIN
    vout_address va ON va.address_id = a.address_id
  JOIN
    vin ON vin.vout_id = va.vout_id
  GROUP BY
    a.address_id
) AS sq
WHERE
  balance.address_id = sq.address_id;

-- first & last blocks and tx count
UPDATE
  balance
SET
  tx = sq.tx_count,
  first_block_id = sq.first_block_id,
  last_block_id = sq.last_block_id
FROM (
  SELECT
    DISTINCT (a.address_id),
    count(DISTINCT tx.tx_id) AS tx_count,
    min(tx.block_id) AS first_block_id,
    max(tx.block_id) AS last_block_id
  FROM
    address a
  JOIN
    vout_address va ON va.address_id = a.address_id
  JOIN
    vout ON vout.vout_id = va.vout_id
  LEFT JOIN
    vin ON vin.vout_id = va.vout_id
  JOIN
    tx ON (tx.tx_id = vout.tx_id OR tx.tx_id = vin.tx_id)
  GROUP BY
    a.address_id
) AS sq
WHERE
  balance.address_id = sq.address_id;


-- stx
UPDATE
  balance
SET
  stx = sq.stx
FROM (
  SELECT
    DISTINCT (a.address_id),
    count(DISTINCT tx.tx_id) AS stx
  FROM
    address a
  JOIN
    vout_address va ON va.address_id = a.address_id
  JOIN
    vout ON vout.vout_id = va.vout_id
  LEFT JOIN
    vin ON vin.vout_id = va.vout_id
  JOIN
    tx ON (tx.tx_id = vout.tx_id OR tx.tx_id = vin.tx_id) AND tx.tree = 1
  GROUP BY
    a.address_id
) AS sq
WHERE
  balance.address_id = sq.address_id;

-- svout count, svout value
UPDATE
  balance
SET
  svout = sq.vout_value,
  svout_count = sq.vout_count
FROM (
  SELECT
    a.address_id,
    coalesce(count(DISTINCT vout.vout_id), 0) AS vout_count,
    coalesce(sum(vout.value), 0) AS vout_value
  FROM
    address a
  JOIN
    vout_address va ON va.address_id = a.address_id
  JOIN
    vout ON vout.vout_id = va.vout_id
  JOIN
    tx ON tx.tx_id = vout.tx_id AND tx.tree = 1
  GROUP BY
    a.address_id
) AS sq
WHERE
  balance.address_id = sq.address_id;

-- svin count, svin amountin
UPDATE
  balance
SET
  svin = sq.vin_amountin,
  svin_count = sq.vin_count
FROM (
  SELECT
    a.address_id,
    coalesce(count(DISTINCT vin.vin_id), 0) AS vin_count,
    coalesce(sum(vin.amountin), 0) AS vin_amountin
  FROM
    address a
  JOIN
    vout_address va ON va.address_id = a.address_id
  JOIN
    vin ON vin.vout_id = va.vout_id
  JOIN
    tx ON tx.tx_id = vin.tx_id AND tx.tree = 1
  GROUP BY
    a.address_id
) AS sq
WHERE
  balance.address_id = sq.address_id;

-- now the tour de force
UPDATE
  balance
SET
  balance = sq.balance
FROM (
  SELECT
    address_id,
    COALESCE((COALESCE(vout, 0) - COALESCE(vin, 0)), 0) AS "balance"
  FROM
    balance
) AS sq
WHERE
  balance.address_id = sq.address_id;

--ALTER TABLE balance DISABLE TRIGGER ALL;
--EXPLAIN ANALYZE UPDATE balance SET balance = COALESCE(vout, 0) - COALESCE(vin, 0) WHERE balance_id < 50000;

ALTER TABLE balance DISABLE TRIGGER ALL;
UPDATE
  balance
SET
  rank = sq.rank
FROM (
  SELECT
    address_id,
    RANK() OVER(ORDER BY "balance" DESC) AS rank
  FROM
    balance
) AS sq
WHERE
  balance.address_id = sq.address_id;
ALTER TABLE balance ENABLE TRIGGER ALL;

-- Start autovacuum for the cluster
-- I'm not a big fan of using the autovacuum right now.
--ALTER SYSTEM SET autovacuum = on;
--SELECT * from pg_reload_conf();