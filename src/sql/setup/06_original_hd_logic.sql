-- Drop old views
DROP VIEW IF EXISTS tx_network_initial_view CASCADE;
DROP VIEW IF EXISTS address_tx_network_initial_view CASCADE;
DROP VIEW IF EXISTS tx_network_second_view CASCADE;
DROP VIEW IF EXISTS address_tx_network_second_view CASCADE;
DROP MATERIALIZED VIEW IF EXISTS tx_network_initial_view CASCADE;
DROP MATERIALIZED VIEW IF EXISTS address_tx_network_initial_view CASCADE;
DROP MATERIALIZED VIEW IF EXISTS tx_network_second_view CASCADE;
DROP MATERIALIZED VIEW IF EXISTS address_tx_network_second_view CASCADE;


-- Now get all tx / address pairs, set to lowest network, store to tx network
CREATE MATERIALIZED VIEW tx_network_initial_view AS
SELECT
  tx.tx_id,
  min(va.address_id) AS network
FROM
  tx
JOIN
  vin ON vin.tx_id = tx.tx_id
JOIN
  vout_address va ON va.vout_id = vin.vout_id
GROUP BY
  tx.tx_id;

CREATE UNIQUE INDEX tx_network_initial_view_tx_id_idx ON tx_network_initial_view (tx_id);
CREATE INDEX tx_network_initial_view_network_idx ON tx_network_initial_view (network);

-- Now find the lowest networks from all of the transactions it belongs to
CREATE VIEW address_tx_network_initial_view AS
SELECT
  va.address_id,
  COALESCE(MIN(tniv.network), va.address_id) AS network
FROM
  vout_address va
LEFT JOIN
  vin ON vin.vout_id = va.vout_id
LEFT JOIN
  tx_network_initial_view tniv ON tniv.tx_id = vin.tx_id
GROUP BY
  va.address_id;

-- Then go BACK and fill in the minimum addresses to the initial txes
CREATE VIEW tx_network_second_view AS
SELECT
  tx.tx_id,
  min(atnv.network) AS network
FROM
  tx
JOIN
  vin ON vin.tx_id = tx.tx_id
JOIN
  vout_address va ON va.vout_id = vin.vout_id
JOIN
  address_tx_network_initial_view atnv ON atnv.address_id = va.address_id
GROUP BY
  tx.tx_id;

--CREATE VIEW tx_network_second_view AS
--SELECT
--  sq.tx_id,
--  min(network) AS network
--FROM (
--  SELECT
--    tx.tx_id,
--    min(va.address_id) AS network
--  FROM
--    tx
--  JOIN
--    vin ON vin.tx_id = tx.tx_id
--  JOIN
--    vout_address va ON va.vout_id = vin.vout_id
--  GROUP BY
--    tx.tx_id
--  UNION ALL
--  SELECT
--    sq.tx_id,
--    min(va.address_id) AS network
--  FROM (
--    SELECT
--      tx.tx_id
--    FROM
--      tx
--    JOIN
--      vout ON vout.tx_id = tx.tx_id
--    JOIN
--      vout_address va ON va.vout_id = vout.vout_id
--    JOIN
--      address a ON a.address_id = va.address_id
--    WHERE
--      vout.type = 'stakesubmission' AND a.address LIKE 'Ds%'
--  ) AS sq
--  JOIN
--    vout ON vout.tx_id = sq.tx_id
--  JOIN
--    vout_address va ON va.vout_id = vout.vout_id
--  GROUP BY
--    sq.tx_id
--) AS sq
--GROUP BY
--  sq.tx_id;

--CREATE INDEX tx_network_second_view_tx_id_idx ON tx_network_second_view (tx_id);
--CREATE INDEX tx_network_second_view_network_idx ON tx_network_second_view (network);

-- Now find the lowest networks from all of the transactions it belongs to
CREATE MATERIALIZED VIEW address_tx_network_second_view AS
SELECT
  va.address_id,
  COALESCE(MIN(tnsv.network), va.address_id) AS network
FROM
  vout_address va
LEFT JOIN
  vin ON vin.vout_id = va.vout_id
LEFT JOIN
  tx_network_second_view tnsv ON tnsv.tx_id = vin.tx_id
GROUP BY
  va.address_id;

CREATE UNIQUE INDEX address_tx_network_second_view_address_id_idx ON address_tx_network_second_view (address_id);
CREATE INDEX address_tx_network_second_view_network_idx ON address_tx_network_second_view (network);

-- Now find the lowest addresses of all connected networks
CREATE MATERIALIZED VIEW address_network_view AS
WITH RECURSIVE network_chain AS (
  SELECT
    address_id,
    init.network
  FROM (
    SELECT
      address_id,
      network
    FROM
      address_tx_network_second_view
    WHERE
      address_id = network
  ) AS init
  WHERE
    network = init.address_id
  UNION
  SELECT
    atnv.address_id,
    nc.network
  FROM
    address_tx_network_second_view atnv
  INNER JOIN
    network_chain nc ON nc.address_id = atnv.network
) SELECT
 *
FROM
 network_chain;

CREATE UNIQUE INDEX address_network_view_address_id_idx ON address_network_view (address_id);
CREATE INDEX address_network_view_network_idx ON address_network_view (network);

-- Determine the top address in the network
CREATE MATERIALIZED VIEW network_top_address_view AS
SELECT
  network,
  address_id
FROM (
  SELECT
    sq.network,
    sq.address_id,
    ROW_NUMBER() OVER (PARTITION BY sq.network ORDER BY sq.balance DESC) AS rownum
  FROM (
      SELECT 
        anv.address_id,
        anv.network,
        asv.balance
      FROM
        address_network_view anv
      JOIN
        address_summary_view asv ON asv.address_id = anv.address_id
    ) AS sq
  ) tmp
WHERE rownum = 1;

CREATE UNIQUE INDEX network_top_address_view_network_idx ON network_top_address_view (network);

-- Now combine all of the address data
CREATE VIEW network_balance_view AS
SELECT
  anv.network,
  SUM(asv.balance) AS balance,
  SUM(asv.liquid_balance) AS liquid_balance,
  SUM(asv.stakesubmission_balance) AS stakesubmission_balance,
  SUM(asv.liquid_vout) AS liquid_vout,
  SUM(asv.stakesubmission_vout) AS stakesubmission_vout,
  SUM(asv.liquid_vin) AS liquid_vin,
  SUM(asv.stakesubmission_vin) AS stakesubmission_vin,
  SUM(asv.tx) AS tx,
  SUM(asv.stx) AS stx,
  COUNT(anv.address_id) AS num_addresses,
  MIN(asv.first_block_id) AS first_block_id,
  MIN(asv.last_block_id) AS last_block_id,
  BOOL_OR(asv.actively_staking) AS actively_staking,
  SUM(asv.active_tickets) AS active_tickets,
  SUM(asv.completed_tickets) AS completed_tickets,
  SUM(asv.revoked_tickets) AS revoked_tickets,
  SUM(asv.active_stakesubmissions) AS active_stakesubmissions,
  SUM(asv.completed_stakesubmissions) AS completed_stakesubmissions
FROM (
  SELECT 
    network,
    address_id
  FROM
    address_network_view
) AS anv
JOIN
  address_summary_view asv ON asv.address_id = anv.address_id
GROUP BY
  anv.network;

-- And finally, the summary
CREATE MATERIALIZED VIEW network_summary_view AS
SELECT
  nbv.*,
  COALESCE(nbv.liquid_vout, 0) + COALESCE(nbv.stakesubmission_vout, 0) AS vout,
  COALESCE(nbv.liquid_vin, 0) + COALESCE(nbv.stakesubmission_vin, 0) AS vin,
  RANK() OVER(ORDER BY nbv.balance DESC) AS rank,
  --RANK() OVER(ORDER BY nbv.liquid_balance DESC) AS liquid_rank,
  --RANK() OVER(ORDER BY nbv.stakesubmission_balance DESC) AS stakesubmission_rank,
  ntav.address_id AS primary_address_id
FROM
  network_balance_view nbv, network_top_address_view ntav
WHERE
  ntav.network = nbv.network;

CREATE UNIQUE INDEX network_summary_view_network_idx ON network_summary_view (network);
CREATE INDEX network_summary_view_rank_idx ON network_summary_view (rank);
--CREATE INDEX network_summary_view_liquid_rank_idx ON network_summary_view (liquid_rank);
--CREATE INDEX network_summary_view_stakesubmission_rank_idx ON network_summary_view (stakesubmission_rank);
CREATE INDEX network_summary_view_balance_idx ON network_summary_view (balance);