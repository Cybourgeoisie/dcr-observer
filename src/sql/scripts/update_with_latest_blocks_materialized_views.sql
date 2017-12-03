-- Do all updates first
BEGIN;

-- Add the new address values to the vout table
UPDATE
  vout
SET
  address_id = sq.address_id
FROM (
  SELECT
    vout_id,
    address_id
  FROM
    vout_address 
  JOIN
    database_blockchain_state dbs ON dbs.database_blockchain_state_id = 1
  WHERE
    vout_id > dbs.last_vout_id
) AS sq
WHERE
  vout.vout_id = sq.vout_id;

-- Add the origin_tx_id to the tx_vote table
UPDATE
  tx_vote
SET
  origin_tx_id = sq.origin_tx_id
FROM (
  SELECT
    tv.tx_vote_id,
    origin_ss_vout.tx_id AS origin_tx_id
  FROM
    tx_vote tv
  JOIN
    vin ON vin.tx_id = tv.tx_id
  JOIN
    vout origin_ss_vout ON
      origin_ss_vout.vout_id = vin.vout_id AND
      origin_ss_vout.type = 'stakesubmission'
  WHERE
    tv.origin_tx_id IS NULL
) AS sq
WHERE
  tx_vote.tx_vote_id = sq.tx_vote_id;

-- Now tie the addresses to the tx_vote table via tx_vote_address
INSERT INTO
  tx_vote_address (tx_vote_id, address_id)
SELECT
  tv.tx_vote_id,
  va.address_id
FROM
  tx_vote tv
JOIN
  vin origin_vin ON origin_vin.tx_id = tv.origin_tx_id
JOIN
  vout_address va ON va.vout_id = origin_vin.vout_id
LEFT JOIN
  tx_vote_address tva ON tva.tx_vote_id = tv.tx_vote_id
WHERE
  tva.tx_vote_address_id IS NULL
ON CONFLICT DO NOTHING;

-- Update the current amount of Decred
UPDATE
  database_blockchain_state
SET
  total_dcr = COALESCE(sq.sum, 0)
FROM (
  SELECT SUM(COALESCE(amountin, 0)) FROM vin WHERE (coinbase != '' OR stakebase != '')
) AS sq;

-- Update the state
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

-- Now rebuild the material views
REFRESH MATERIALIZED VIEW CONCURRENTLY address_vout_vin_view;
REFRESH MATERIALIZED VIEW CONCURRENTLY address_balance_view;
REFRESH MATERIALIZED VIEW CONCURRENTLY address_summary_view;
REFRESH MATERIALIZED VIEW CONCURRENTLY tx_network_initial_view;
REFRESH MATERIALIZED VIEW CONCURRENTLY address_tx_network_second_view;
REFRESH MATERIALIZED VIEW CONCURRENTLY address_network_view;
REFRESH MATERIALIZED VIEW CONCURRENTLY network_top_address_view;
REFRESH MATERIALIZED VIEW CONCURRENTLY network_summary_view;
REFRESH MATERIALIZED VIEW CONCURRENTLY address_vout_breakdown_view;
