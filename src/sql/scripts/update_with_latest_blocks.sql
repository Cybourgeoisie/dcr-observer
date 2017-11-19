-- Do all updates first
BEGIN;

-- From the state, update the entries in the balance table
-- vout count, vout value
UPDATE
  balance
SET
  vout = balance.vout + COALESCE(sq.vout_value, 0),
  vout_count = balance.vout_count + 1
FROM (
  SELECT
    DISTINCT ON (vout.vout_id)
    va.address_id,
    COALESCE(vout.value, 0) AS vout_value
  FROM
    database_blockchain_state dbs
  JOIN
    vout ON vout.vout_id > dbs.last_vout_id
  JOIN
    vout_address va ON va.vout_id = vout.vout_id
  WHERE
    dbs.database_blockchain_state_id = 1
  GROUP BY
    vout.vout_id,
    va.address_id
) AS sq
WHERE
  balance.address_id = sq.address_id;


-- vin count, vin amountin
UPDATE
  balance
SET
  vin = balance.vin + COALESCE(sq.vin_amountin, 0),
  vin_count = balance.vin_count + 1
FROM (
  SELECT
    DISTINCT ON (vin.vin_id)
    va.address_id,
    COALESCE(vin.amountin, 0) AS vin_amountin
  FROM
    database_blockchain_state dbs
  JOIN
    vin ON vin.vin_id > dbs.last_vin_id
  JOIN
    vout_address va ON va.vout_id = vin.vout_id
  WHERE
    dbs.database_blockchain_state_id = 1
  GROUP BY
    vin.vin_id,
    va.address_id
) AS sq
WHERE
  balance.address_id = sq.address_id;

-- last block and tx count
UPDATE
  balance
SET
  tx = balance.tx + sq.tx_count,
  last_block_id = sq.last_block_id
FROM (
  SELECT
    DISTINCT (va.address_id),
    count(DISTINCT tx.tx_id) AS tx_count,
    max(tx.block_id) AS last_block_id
  FROM
    database_blockchain_state dbs
  JOIN
    tx ON tx.tx_id > dbs.last_tx_id
  LEFT JOIN
    vout ON vout.tx_id = tx.tx_id
  LEFT JOIN
    vin ON vin.tx_id = tx.tx_id
  JOIN
    vout_address va ON va.vout_id = vout.vout_id OR va.vout_id = vin.vout_id
  WHERE
    dbs.database_blockchain_state_id = 1
  GROUP BY
    va.address_id
) AS sq
WHERE
  balance.address_id = sq.address_id;

-- stx
UPDATE
  balance
SET
  stx = balance.stx + sq.stx
FROM (
  SELECT
    DISTINCT (va.address_id),
    count(DISTINCT tx.tx_id) AS stx
  FROM
    database_blockchain_state dbs
  JOIN
    tx ON tx.tx_id > dbs.last_tx_id AND tx.tree = 1
  LEFT JOIN
    vout ON vout.tx_id = tx.tx_id
  LEFT JOIN
    vin ON vin.tx_id = tx.tx_id
  JOIN
    vout_address va ON va.vout_id = vout.vout_id OR va.vout_id = vin.vout_id
  WHERE
    dbs.database_blockchain_state_id = 1
  GROUP BY
    va.address_id
) AS sq
WHERE
  balance.address_id = sq.address_id;


-- svout count, svout value
UPDATE
  balance
SET
  svout = balance.svout + COALESCE(sq.vout_value, 0),
  svout_count = balance.svout_count + 1
FROM (
  SELECT
    DISTINCT ON (vout.vout_id)
    va.address_id,
    COALESCE(vout.value, 0) AS vout_value
  FROM
    database_blockchain_state dbs
  JOIN
    vout ON vout.vout_id > dbs.last_vout_id
  JOIN
    vout_address va ON va.vout_id = vout.vout_id
  JOIN
    tx ON tx.tx_id = vout.tx_id AND tx.tree = 1
  WHERE
    dbs.database_blockchain_state_id = 1
  GROUP BY
    vout.vout_id,
    va.address_id
) AS sq
WHERE
  balance.address_id = sq.address_id;


-- svin count, svin amountin
UPDATE
  balance
SET
  svin = balance.svin + COALESCE(sq.vin_amountin, 0),
  svin_count = balance.svin_count + 1
FROM (
  SELECT
    DISTINCT ON (vin.vin_id)
    va.address_id,
    COALESCE(vin.amountin, 0) AS vin_amountin
  FROM
    database_blockchain_state dbs
  JOIN
    vin ON vin.vin_id > dbs.last_vin_id
  JOIN
    vout_address va ON va.vout_id = vin.vout_id
  JOIN
    tx ON tx.tx_id = vin.tx_id AND tx.tree = 1
  WHERE
    dbs.database_blockchain_state_id = 1
  GROUP BY
    vin.vin_id,
    va.address_id
) AS sq
WHERE
  balance.address_id = sq.address_id;

COMMIT;
-- End of all updates


-- Now update balance
BEGIN;

UPDATE
  balance
SET
  balance = sq.balance
FROM (
  SELECT
    b.address_id,
    COALESCE((COALESCE(b.vout, 0) - COALESCE(b.vin, 0)), 0) AS "balance"
  FROM
    balance b
  JOIN
    database_blockchain_state dbs ON b.last_block_id > dbs.last_block_id
  WHERE
    dbs.database_blockchain_state_id = 1
) AS sq
WHERE
  balance.address_id = sq.address_id;

COMMIT;

-- Finally, update the rank
BEGIN;
-- This has to be recomputed in its entireity
-- PROBABLY should only be done a few times a day. It's slow and it locks up the table.
UPDATE
  balance
SET
  rank = sq.rank
FROM (
  SELECT
    b.address_id,
    RANK() OVER(ORDER BY b.balance DESC) AS rank
  FROM
    balance b, database_blockchain_state dbs
  WHERE
    dbs.database_blockchain_state_id = 1 AND
    (b.balance > 0 OR b.last_block_id > dbs.last_block_id)
) AS sq
WHERE
  balance.address_id = sq.address_id;

COMMIT;

-- Now the fat boy
BEGIN;

UPDATE database_blockchain_state SET total_dcr = total_dcr + COALESCE(sq.sum, 0)
FROM (
  SELECT SUM(COALESCE(amountin, 0))
  FROM database_blockchain_state dbs
  JOIN vin ON vin.vin_id > dbs.last_vin_id
  WHERE (coinbase != '' OR stakebase != '') AND dbs.database_blockchain_state_id = 1
) AS sq;

COMMIT;


-- Lastly, update the state
BEGIN;

UPDATE database_blockchain_state SET last_block_id = sq.block_id
FROM (SELECT block_id FROM block ORDER BY block_id DESC LIMIT 1) AS sq;

UPDATE database_blockchain_state SET last_tx_id = sq.tx_id
FROM (SELECT tx_id FROM tx ORDER BY tx_id DESC LIMIT 1) AS sq;

UPDATE database_blockchain_state SET last_vout_id = sq.vout_id
FROM (SELECT vout_id FROM vout ORDER BY vout_id DESC LIMIT 1) AS sq;

UPDATE database_blockchain_state SET last_vin_id = sq.vin_id
FROM (SELECT vin_id FROM vin ORDER BY vin_id DESC LIMIT 1) AS sq;

UPDATE database_blockchain_state SET last_address_id = sq.address_id
FROM (SELECT address_id FROM address ORDER BY address_id DESC LIMIT 1) AS sq;

UPDATE database_blockchain_state SET last_vout_address_id = sq.vout_address_id
FROM (SELECT vout_address_id FROM vout_address ORDER BY vout_address_id DESC LIMIT 1) AS sq;

COMMIT;