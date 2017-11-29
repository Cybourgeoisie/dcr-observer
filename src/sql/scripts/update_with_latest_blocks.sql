-- Do all updates first
BEGIN;

ALTER TABLE balance DISABLE TRIGGER ALL;

-- Add new addresses
INSERT INTO balance (address_id, first_block_id)
SELECT a.address_id, min(tx.block_id)
FROM address a
JOIN database_blockchain_state dbs ON dbs.last_address_id < a.address_id
JOIN vout_address va ON va.address_id = a.address_id
JOIN vout ON vout.vout_id = va.vout_id
JOIN tx ON tx.tx_id = vout.tx_id
WHERE dbs.database_blockchain_state_id = 1
GROUP BY a.address_id
ON CONFLICT DO NOTHING;

-- These updates for vout, vin, and counts are incorrect


-- From the state, update the entries in the balance table
-- vout count, vout value
UPDATE
  balance
SET
  vout = COALESCE(balance.vout, 0) + COALESCE(sq.vout_value, 0),
  vout_count = COALESCE(balance.vout_count, 0) + COALESCE(sq.vout_count, 0)
FROM (
  SELECT
    DISTINCT va.address_id,
    COALESCE(SUM(COALESCE(vout.value, 0)), 0) AS vout_value,
    COUNT(DISTINCT vout.vout_id) AS vout_count
  FROM
    database_blockchain_state dbs
  JOIN
    vout ON vout.vout_id > dbs.last_vout_id
  JOIN
    vout_address va ON va.vout_id = vout.vout_id
  WHERE
    dbs.database_blockchain_state_id = 1
  GROUP BY
    va.address_id
) AS sq
WHERE
  balance.address_id = sq.address_id;

-- vin count, vin amountin
UPDATE
  balance
SET
  vin = COALESCE(balance.vin, 0) + COALESCE(sq.vin_amountin, 0),
  vin_count = COALESCE(balance.vin_count, 0) + COALESCE(sq.vin_count, 0)
FROM (
  SELECT
    DISTINCT va.address_id,
    COALESCE(SUM(COALESCE(vin.amountin, 0)), 0) AS vin_amountin,
    COUNT(DISTINCT vin.vin_id) AS vin_count
  FROM
    database_blockchain_state dbs
  JOIN
    vin ON vin.vin_id > dbs.last_vin_id
  JOIN
    vout_address va ON va.vout_id = vin.vout_id
  WHERE
    dbs.database_blockchain_state_id = 1
  GROUP BY
    va.address_id
) AS sq
WHERE
  balance.address_id = sq.address_id;

-- last block and tx count
UPDATE
  balance
SET
  tx = COALESCE(balance.tx, 0) + COALESCE(sq.tx_count, 0),
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
-- BROKEN!!!!!!!
UPDATE
  balance
SET
  stx = COALESCE(balance.stx, 0) + COALESCE(sq.stx, 0)
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
  svout = COALESCE(balance.svout, 0) + COALESCE(sq.svout_value, 0),
  svout_count = COALESCE(balance.svout_count, 0) + COALESCE(sq.svout_count, 0)
FROM (
  SELECT
    DISTINCT va.address_id,
    COALESCE(SUM(COALESCE(vout.value, 0)), 0) AS svout_value,
    COUNT(DISTINCT vout.vout_id) AS svout_count
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
    va.address_id
) AS sq
WHERE
  balance.address_id = sq.address_id;


-- svin count, svin amountin
UPDATE
  balance
SET
  svin = COALESCE(balance.svin, 0) + COALESCE(sq.svin_amountin, 0),
  svin_count = COALESCE(balance.svin_count, 0) + COALESCE(sq.svin_count, 0)
FROM (
  SELECT
    DISTINCT va.address_id,
    COALESCE(SUM(COALESCE(vin.amountin, 0)), 0) AS svin_amountin,
    COUNT(DISTINCT vin.vin_id) AS svin_count
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
    va.address_id
) AS sq
WHERE
  balance.address_id = sq.address_id;

---- liquid
--UPDATE
--  balance
--SET
--  liquid = COALESCE(balance.liquid, 0) + COALESCE(sq.liquid_vout, 0) - COALESCE(sq.liquid_vin, 0)
--FROM (
--  SELECT
--    DISTINCT va.address_id,
--    COALESCE(SUM(vout.value), 0) AS liquid_vout,
--    COALESCE(SUM(vin.amountin), 0) AS liquid_vin
--  FROM
--    database_blockchain_state dbs
--  JOIN
--    vout ON vout.type != 'stakesubmission' AND vout.vout_id > dbs.last_vout_id
--  JOIN
--    vin ON vin.vin_id > dbs.last_vin_id
--  JOIN
--    vout prior_vout ON prior_vout.vout_id = vin.vout_id AND prior_vout.type != 'stakesubmission'
--  JOIN
--    vout_address va ON vout.vout_id = va.vout_id OR vin.vout_id = va.vout_id
--  WHERE
--    dbs.database_blockchain_state_id = 1
--  GROUP BY
--    va.address_id
--) AS sq
--WHERE
--  balance.address_id = sq.address_id;
--
---- staking
--UPDATE
--  balance
--SET
--  active_stake_submissions = COALESCE(balance.active_stake_submissions, 0) + COALESCE(sq.stake_submissions_vout, 0) - COALESCE(sq.stake_submissions_vin, 0)
--FROM (
--  SELECT
--    DISTINCT va.address_id,
--    COALESCE(SUM(vout.value), 0) AS stake_submissions_vout,
--    COALESCE(SUM(vin.amountin), 0) AS stake_submissions_vin
--  FROM
--    database_blockchain_state dbs
--  JOIN
--    vout ON vout.type = 'stakesubmission' AND vout.vout_id > dbs.last_vout_id
--  JOIN
--    vin ON vin.vin_id > dbs.last_vin_id
--  JOIN
--    vout prior_vout ON prior_vout.vout_id = vin.vout_id AND prior_vout.type = 'stakesubmission'
--  JOIN
--    vout_address va ON vout.vout_id = va.vout_id OR vin.vout_id = va.vout_id
--  WHERE
--    dbs.database_blockchain_state_id = 1
--  GROUP BY
--    va.address_id
--) AS sq
--WHERE
--  balance.address_id = sq.address_id;

-- liquid
UPDATE
  balance
SET
  liquid = sq.liquid
FROM (
  SELECT
    DISTINCT a.address_id,
    COALESCE(SUM(vout.value), 0) AS liquid
  FROM
    address a 
  JOIN
    vout_address va ON va.address_id = a.address_id
  JOIN
    vout ON vout.vout_id = va.vout_id AND vout.type != 'stakesubmission' 
  LEFT JOIN
    vin ON vin.vout_id = vout.vout_id 
  WHERE
    vin.vin_id IS NULL
  GROUP BY
    a.address_id
) AS sq
WHERE
  balance.address_id = sq.address_id;

-- staking
UPDATE
  balance
SET
  active_stake_submissions = sq.stake_submissions
FROM (
  SELECT
    DISTINCT a.address_id,
    COALESCE(SUM(vout.value), 0) AS stake_submissions
  FROM
    address a 
  JOIN
    vout_address va ON va.address_id = a.address_id
  JOIN
    vout ON vout.vout_id = va.vout_id AND vout.type = 'stakesubmission' 
  LEFT JOIN
    vin ON vin.vout_id = vout.vout_id 
  WHERE
    vin.vin_id IS NULL
  GROUP BY
    a.address_id
) AS sq
WHERE
  balance.address_id = sq.address_id;

ALTER TABLE balance ENABLE TRIGGER ALL;

COMMIT;
-- End of all updates

VACUUM FULL ANALYZE balance;

-- Now update balance
BEGIN;

UPDATE
  balance
SET
  balance = COALESCE(sq.balance, 0)
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

VACUUM FULL ANALYZE balance;

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

-- Now the address networks
BEGIN;

-- Update the address networks
UPDATE
  address
SET
  network = address_id
FROM (
  SELECT
    last_address_id
  FROM
    database_blockchain_state
  WHERE
    database_blockchain_state_id = 1
) AS dbs
WHERE
  address_id > dbs.last_address_id;

-- Add the new tx networks
INSERT INTO
  tx_network (tx_id, network)
SELECT
  tx.tx_id, 9223372036854775800
FROM
  database_blockchain_state dbs
JOIN
  tx ON tx.tx_id > dbs.last_tx_id
WHERE
  dbs.database_blockchain_state_id = 1
ON CONFLICT DO NOTHING;


-- Now we need to do mixing with the txes
-- (1) Get all tx / address pairs, set to lowest network, store to tx network
UPDATE
    tx_network
SET
    network = LEAST(tx_network.network, sq.network)
FROM (
    SELECT
        tx.tx_id,
        min(a.network) AS network
    FROM
        tx
    JOIN
        vin ON vin.tx_id = tx.tx_id
    JOIN
        vout_address va ON va.vout_id = vin.vout_id
    JOIN
        address a ON a.address_id = va.address_id
    JOIN
        database_blockchain_state dbs ON dbs.database_blockchain_state_id = 1
    WHERE
        tx.tx_id > dbs.last_tx_id
    GROUP BY
        tx.tx_id
    ORDER BY
        tx.tx_id
) as sq
WHERE
    tx_network.tx_id = sq.tx_id;

-- (2) Get all networks from txes that the address is matched to
-- and update the address's network with the lowest from tx
UPDATE
    address
SET
    network = sq.network
FROM (
    SELECT
        va.address_id,
        min(tn.network) AS network
    FROM 
        tx_network tn
    JOIN
        vin ON vin.tx_id = tn.tx_id
    JOIN
        vout_address va ON va.vout_id = vin.vout_id
    JOIN
        database_blockchain_state dbs ON dbs.database_blockchain_state_id = 1
    WHERE
        tn.tx_id > dbs.last_tx_id
    GROUP BY
        va.address_id
) as sq
WHERE
    address.address_id = sq.address_id;


COMMIT;


VACUUM FULL ANALYZE address;
VACUUM FULL ANALYZE tx_network;


-- Now update the hd_network stats
BEGIN;

ALTER TABLE hd_network DISABLE TRIGGER ALL;

-- Delete the existing balances, address counts, & addresses
UPDATE hd_network SET address_id = NULL, balance = 0, num_addresses = 0;

-- Insert any new hd networks
INSERT INTO 
    "hd_network" (network, balance)
SELECT
    DISTINCT ON (a.network)
    a.network,
    COALESCE(SUM(COALESCE(b.balance, 0)), 0) AS balance
FROM
    address a
JOIN
    balance b ON b.address_id = a.address_id
JOIN
    database_blockchain_state dbs ON dbs.database_blockchain_state_id = 1
WHERE
    a.address_id > dbs.last_address_id
GROUP BY
    a.network
ON CONFLICT DO NOTHING;

-- hd balance
UPDATE
    hd_network
SET
    balance = sq.balance
FROM (
    SELECT
        DISTINCT ON (a.network)
        a.network,
        SUM(COALESCE(b.balance, 0)) AS balance
    FROM
        address a
    JOIN
        balance b ON b.address_id = a.address_id
    GROUP BY
        a.network
) AS sq
WHERE
    hd_network.network = sq.network;

-- hd rank
UPDATE
  hd_network
SET
  rank = sq.rank
FROM (
  SELECT
    network,
    RANK() OVER(ORDER BY balance DESC) AS rank
  FROM
    hd_network
) AS sq
WHERE
  hd_network.network = sq.network;

COMMIT;

VACUUM FULL ANALYZE hd_network;

BEGIN;

-- hd num addresses
UPDATE
  hd_network
SET
  num_addresses = sq.num_addresses
FROM (
    SELECT
        network,
        COUNT(DISTINCT address_id) AS num_addresses
    FROM 
        address
    GROUP BY
        network
) AS sq
WHERE
  hd_network.network = sq.network;

-- hd primary address
UPDATE
  hd_network
SET
  address_id = sq.address_id
FROM (
    SELECT 
        DISTINCT ON (a.network)
        a.network,
        a.address_id
    FROM
        address a
    JOIN
        balance b ON b.address_id = a.address_id
    ORDER BY
        a.network, b.balance DESC
) AS sq
WHERE
  hd_network.network = sq.network;

ALTER TABLE hd_network ENABLE TRIGGER ALL;

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
