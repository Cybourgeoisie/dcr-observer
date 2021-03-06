--------------------
-- Clear Errthang --
--------------------

DROP MATERIALIZED VIEW IF EXISTS address_vout_vin_view CASCADE;
DROP VIEW IF EXISTS address_rtx_view CASCADE;
DROP VIEW IF EXISTS address_stx_view CASCADE;
DROP VIEW IF EXISTS address_block_activity_view CASCADE;
DROP VIEW IF EXISTS address_actively_staking_view CASCADE;
DROP VIEW IF EXISTS address_stake_submissions_view CASCADE;
DROP VIEW IF EXISTS hd_address_tx_logic_view CASCADE;
DROP VIEW IF EXISTS address_owner_identifiers_view CASCADE;
DROP VIEW IF EXISTS address_origin_identifiers_view CASCADE;
DROP VIEW IF EXISTS address_ticket_identifiers_view CASCADE;
DROP MATERIALIZED VIEW IF EXISTS address_rtx_view CASCADE;
DROP MATERIALIZED VIEW IF EXISTS address_stx_view CASCADE;
DROP MATERIALIZED VIEW IF EXISTS address_block_activity_view CASCADE;
DROP MATERIALIZED VIEW IF EXISTS address_actively_staking_view CASCADE;
DROP MATERIALIZED VIEW IF EXISTS address_stake_submissions_view CASCADE;
DROP MATERIALIZED VIEW IF EXISTS hd_address_tx_logic_view CASCADE;
DROP MATERIALIZED VIEW IF EXISTS address_vout_breakdown_view CASCADE;


-------------------
-- Addr Balances --
-------------------

CREATE MATERIALIZED VIEW address_vout_vin_view AS
SELECT 
  DISTINCT va.address_id,
  COALESCE(sq.vout, 0)  AS liquid_vout,
  COALESCE(sq1.vout, 0) AS stakesubmission_vout,
  COALESCE(sq2.vin, 0)  AS liquid_vin,
  COALESCE(sq3.vin, 0)  AS stakesubmission_vin
FROM
  vout_address va
LEFT JOIN (
  SELECT
    address_id,
    coalesce(sum(coalesce(value, 0)), 0) AS vout
  FROM
    vout
  WHERE
    vout.type != 'stakesubmission'
  GROUP BY
    address_id
) AS sq ON sq.address_id = va.address_id
LEFT JOIN (
  SELECT
    address_id,
    coalesce(sum(coalesce(value, 0)), 0) AS vout
  FROM
    vout
  WHERE
    vout.type = 'stakesubmission'
  GROUP BY
    address_id
) AS sq1 ON sq1.address_id = va.address_id
LEFT JOIN (
  SELECT
    vout.address_id,
    coalesce(sum(coalesce(vin.amountin, 0)), 0) AS vin
  FROM
    vout
  JOIN
    vin ON vin.vout_id = vout.vout_id
  WHERE
    vout.type != 'stakesubmission'
  GROUP BY
    vout.address_id
) AS sq2 ON sq2.address_id = va.address_id
LEFT JOIN (
  SELECT
    vout.address_id,
    coalesce(sum(coalesce(vin.amountin, 0)), 0) AS vin
  FROM
    vout
  JOIN
    vin ON vin.vout_id = vout.vout_id
  WHERE
    vout.type = 'stakesubmission'
  GROUP BY
    vout.address_id
) AS sq3 ON sq3.address_id = va.address_id;

CREATE UNIQUE INDEX address_vout_vin_view_address_id_idx ON address_vout_vin_view (address_id);

CREATE MATERIALIZED VIEW address_balance_view AS
SELECT 
  address_id,
  coalesce(liquid_vout, 0) + coalesce(stakesubmission_vout, 0) - coalesce(liquid_vin, 0) - coalesce(stakesubmission_vin, 0) AS balance,
  coalesce(liquid_vout, 0) - coalesce(liquid_vin, 0) AS liquid_balance,
  coalesce(stakesubmission_vout, 0) - coalesce(stakesubmission_vin, 0) AS stakesubmission_balance
FROM 
  address_vout_vin_view
ORDER BY
  2 DESC;

CREATE UNIQUE INDEX address_balance_view_address_id_idx ON address_balance_view (address_id);
CREATE INDEX address_balance_view_balance_idx ON address_balance_view (balance);
CREATE INDEX address_balance_view_liquid_balance_idx ON address_balance_view (liquid_balance);
CREATE INDEX address_balance_view_stakesubmission_balance_idx ON address_balance_view (stakesubmission_balance);

CREATE MATERIALIZED VIEW address_rtx_view AS
SELECT
  vout.address_id,
  count(distinct rtx.tx_id) AS rtx
FROM
  vout
LEFT JOIN
  vin ON vin.vout_id = vout.vout_id
LEFT JOIN 
  tx rtx ON (rtx.tx_id = vout.tx_id OR rtx.tx_id = vin.tx_id) AND rtx.tree = 0
WHERE
  vout.address_id IS NOT NULL
GROUP BY
  vout.address_id;

CREATE UNIQUE INDEX address_rtx_view_address_id_idx ON address_rtx_view (address_id);

CREATE MATERIALIZED VIEW address_stx_view AS
SELECT
  vout.address_id,
  count(distinct stx.tx_id) AS stx
FROM
  vout
LEFT JOIN
  vin ON vin.vout_id = vout.vout_id
LEFT JOIN 
  tx stx ON (stx.tx_id = vout.tx_id OR stx.tx_id = vin.tx_id) AND stx.tree = 1
WHERE
  vout.address_id IS NOT NULL
GROUP BY
  vout.address_id;

CREATE UNIQUE INDEX address_stx_view_address_id_idx ON address_stx_view (address_id);

CREATE MATERIALIZED VIEW address_block_activity_view AS
SELECT
  vout.address_id,
  min(tx.block_id) AS first_block_id,
  max(tx.block_id) AS last_block_id
FROM
  vout
LEFT JOIN
  vin ON vin.vout_id = vout.vout_id
JOIN
  tx ON (tx.tx_id = vout.tx_id OR tx.tx_id = vin.tx_id)
WHERE
  vout.address_id IS NOT NULL
GROUP BY
  vout.address_id;

CREATE UNIQUE INDEX address_block_activity_view_address_id_idx ON address_block_activity_view (address_id);

-- Determine if an address is actively staking
CREATE MATERIALIZED VIEW address_actively_staking_view AS
SELECT
  sq.address_id,
  BOOL_OR(actively_staking) AS actively_staking,
  SUM(active_tickets) AS active_tickets,
  SUM(completed_tickets) AS completed_tickets,
  SUM(revoked_tickets) AS revoked_tickets
FROM (
  SELECT
    DISTINCT ON (va.address_id, sender_vin.tx_id)
    va.address_id,
    sender_vin.tx_id,
    next_vin.vin_id IS NULL AS actively_staking,
    CASE WHEN (next_vin.vin_id IS NULL) THEN 1 ELSE 0 END AS active_tickets,
    CASE WHEN (next_vin.vin_id IS NOT NULL AND stakerevoke_vout.vout_id IS NULL) THEN 1 ELSE 0 END AS completed_tickets,
    CASE WHEN (next_vin.vin_id IS NOT NULL AND stakerevoke_vout.vout_id IS NOT NULL) THEN 1 ELSE 0 END AS revoked_tickets
  FROM
    vout
  LEFT JOIN
    vin next_vin ON next_vin.vout_id = vout.vout_id
  LEFT JOIN
    vout stakerevoke_vout ON stakerevoke_vout.tx_id = next_vin.tx_id AND stakerevoke_vout.type = 'stakerevoke'
  JOIN
    vin sender_vin ON sender_vin.tx_id = vout.tx_id
  JOIN
    vout_address va ON va.vout_id = sender_vin.vout_id
  WHERE
    vout.type = 'stakesubmission'
) AS sq
GROUP BY 
  sq.address_id;

CREATE UNIQUE INDEX address_actively_staking_view_address_id_idx ON address_actively_staking_view (address_id);

-- For those addresses used for stake submissions, keep track of tickets active and completed
CREATE MATERIALIZED VIEW address_stake_submissions_view AS
SELECT
  DISTINCT vout.address_id,
  SUM(CASE WHEN vin.vin_id IS NULL THEN 1 ELSE 0 END) AS active_stakesubmissions,
  SUM(CASE WHEN vin.vin_id IS NOT NULL THEN 1 ELSE 0 END) AS completed_stakesubmissions
FROM
  vout
LEFT JOIN
  vin ON vin.vout_id = vout.vout_id
WHERE
  vout.type = 'stakesubmission'
GROUP BY
  vout.address_id;

CREATE UNIQUE INDEX address_stake_submissions_view_address_id_idx ON address_stake_submissions_view (address_id);

-- Now combine the rest
CREATE MATERIALIZED VIEW address_summary_view AS
SELECT
  avvv.address_id,
  avvv.liquid_vout,
  avvv.stakesubmission_vout,
  COALESCE(avvv.liquid_vout, 0) + COALESCE(avvv.stakesubmission_vout, 0) AS vout,
  avvv.liquid_vin,
  avvv.stakesubmission_vin,
  COALESCE(avvv.liquid_vin, 0) + COALESCE(avvv.stakesubmission_vin, 0) AS vin,
  abv.balance,
  abv.liquid_balance,
  abv.stakesubmission_balance,
  RANK() OVER(ORDER BY abv.balance DESC) AS rank,
  --RANK() OVER(ORDER BY abv.liquid_balance DESC) AS liquid_rank,
  --RANK() OVER(ORDER BY abv.stakesubmission_balance DESC) AS stakesubmission_rank,
  COALESCE(artxv.rtx, 0) + COALESCE(astxv.stx, 0) AS tx,
  artxv.rtx,
  astxv.stx,
  abav.first_block_id,
  abav.last_block_id,
  COALESCE(aasv.actively_staking, 'f') AS actively_staking,
  COALESCE(aasv.active_tickets, 0) AS active_tickets,
  COALESCE(aasv.completed_tickets, 0) AS completed_tickets,
  COALESCE(aasv.revoked_tickets, 0) AS revoked_tickets,
  COALESCE(assv.active_stakesubmissions, 0) AS active_stakesubmissions,
  COALESCE(assv.completed_stakesubmissions, 0) AS completed_stakesubmissions
FROM
  address_vout_vin_view avvv
JOIN
  address_balance_view abv ON abv.address_id = avvv.address_id
JOIN
  address_rtx_view artxv ON artxv.address_id = avvv.address_id
JOIN
  address_stx_view astxv ON astxv.address_id = avvv.address_id
JOIN
  address_block_activity_view abav ON abav.address_id = avvv.address_id
LEFT JOIN
  address_actively_staking_view aasv ON aasv.address_id = avvv.address_id
LEFT JOIN
  address_stake_submissions_view assv ON assv.address_id = avvv.address_id;

CREATE UNIQUE INDEX address_summary_view_address_id_idx ON address_summary_view (address_id);
CREATE INDEX address_summary_view_rank_idx ON address_summary_view (rank);
--CREATE INDEX address_summary_view_liquid_rank_idx ON address_summary_view (liquid_rank);
--CREATE INDEX address_summary_view_stakesubmission_rank_idx ON address_summary_view (stakesubmission_rank);
CREATE INDEX address_summary_view_balance_idx ON address_summary_view (balance);

-----------------
-- HD Networks --
-----------------

-- Get all addresses attached to transactions that interest us
CREATE MATERIALIZED VIEW hd_address_tx_logic_view AS
SELECT -- Get all tx<->[vin address] relationships
  tx.tx_id,
  va.address_id
FROM
  tx
JOIN
  vin ON vin.tx_id = tx.tx_id
JOIN
  vout_address va ON va.vout_id = vin.vout_id
UNION
SELECT -- Get some vout addresses from solo staking addresses
  sq.tx_id,
  vout.address_id
FROM ( -- get all tx<->[vout address] relationships ONLY for txes with a vout with stakesubmission to a Ds% address
  SELECT
    tx.tx_id
  FROM
    tx
  JOIN
    vout ON vout.tx_id = tx.tx_id
  JOIN
    vout_address va ON va.vout_id = vout.vout_id
  JOIN
    address a ON a.address_id = va.address_id
  WHERE
    vout.type = 'stakesubmission' AND a.address LIKE 'Ds%'
) AS sq
JOIN
  vout ON vout.tx_id = sq.tx_id AND (vout.type = 'stakesubmission' OR vout.type = 'sstxcommitment');

--UNION
--SELECT -- Get the Dc% ticket addresses and grant to the vins
--  tx.tx_id,
--  va.address_id
--FROM
--  tx
--JOIN
--  vout ON vout.tx_id = tx.tx_id
--JOIN
--  vout_address va ON va.vout_id = vout.vout_id
--JOIN
--  address a ON a.address_id = va.address_id
--WHERE
--  vout.type = 'stakesubmission' AND a.address LIKE 'Dc%'
--UNION
--SELECT
--  tx_id,
--  address_id
--FROM (
--  SELECT -- Get the highest sstxcommitment for Dc% tickets
--    sq.tx_id,
--    sq.address_id,
--    ROW_NUMBER() OVER (PARTITION BY sq.tx_id ORDER BY sq.value DESC) AS rownum
--  FROM (
--    SELECT
--      vout.tx_id,
--      va.address_id,
--      vout.value
--    FROM (
--      SELECT
--        tx.tx_id
--      FROM
--        tx
--      JOIN
--        vout ON vout.tx_id = tx.tx_id
--      JOIN
--        vout_address va ON va.vout_id = vout.vout_id
--      JOIN
--        address a ON a.address_id = va.address_id
--      WHERE
--        vout.type = 'stakesubmission' AND a.address LIKE 'Dc%'
--    ) AS sq
--    JOIN
--      vout ON vout.tx_id = sq.tx_id AND vout.type = 'sstxcommitment'
--    JOIN
--      vout_address va ON va.vout_id = vout.vout_id
--  ) AS sq
--) AS tmp
--WHERE rownum = 1;

-- Now get all tx / address pairs, set to lowest network, store to tx network
CREATE MATERIALIZED VIEW tx_network_initial_view AS
SELECT
  tx_id,
  min(address_id) AS network
FROM
  hd_address_tx_logic_view
GROUP BY
  tx_id;

CREATE UNIQUE INDEX tx_network_initial_view_tx_id_idx ON tx_network_initial_view (tx_id);
CREATE INDEX tx_network_initial_view_network_idx ON tx_network_initial_view (network);

-- Now find the lowest networks from all of the transactions it belongs to
CREATE VIEW address_tx_network_initial_view AS
SELECT
  hatlv.address_id,
  MIN(tniv.network) AS network
FROM
  hd_address_tx_logic_view hatlv
LEFT JOIN
  tx_network_initial_view tniv ON tniv.tx_id = hatlv.tx_id
GROUP BY
  hatlv.address_id;

-- Then go BACK and fill in the minimum addresses to the initial txes
CREATE VIEW tx_network_second_view AS
SELECT
  hatlv.tx_id,
  MIN(atnv.network) AS network
FROM
  hd_address_tx_logic_view hatlv
JOIN
  address_tx_network_initial_view atnv ON atnv.address_id = hatlv.address_id
GROUP BY
  hatlv.tx_id;

-- Now find the lowest networks from all of the transactions it belongs to
CREATE VIEW address_tx_network_second_view AS
SELECT
  hatlv.address_id,
  MIN(tniv.network) AS network
FROM
  hd_address_tx_logic_view hatlv
LEFT JOIN
  tx_network_second_view tniv ON tniv.tx_id = hatlv.tx_id
GROUP BY
  hatlv.address_id;

-- HALFWAY POINT
-- Then go BACK and fill in the minimum addresses to the initial txes
CREATE MATERIALIZED VIEW tx_network_third_view AS
SELECT
  hatlv.tx_id,
  MIN(atnv.network) AS network
FROM
  hd_address_tx_logic_view hatlv
JOIN
  address_tx_network_second_view atnv ON atnv.address_id = hatlv.address_id
GROUP BY
  hatlv.tx_id;

CREATE UNIQUE INDEX tx_network_third_view_tx_id_idx ON tx_network_third_view (tx_id);
CREATE INDEX tx_network_third_view_network_idx ON tx_network_third_view (network);


-- Now find the lowest networks from all of the transactions it belongs to
CREATE VIEW address_tx_network_third_view AS
SELECT
  hatlv.address_id,
  MIN(tniv.network) AS network
FROM
  hd_address_tx_logic_view hatlv
LEFT JOIN
  tx_network_third_view tniv ON tniv.tx_id = hatlv.tx_id
GROUP BY
  hatlv.address_id;

-- Then go BACK and fill in the minimum addresses to the initial txes
CREATE VIEW tx_network_fourth_view AS
SELECT
  hatlv.tx_id,
  MIN(atnv.network) AS network
FROM
  hd_address_tx_logic_view hatlv
JOIN
  address_tx_network_third_view atnv ON atnv.address_id = hatlv.address_id
GROUP BY
  hatlv.tx_id;

-- Now find the lowest networks from all of the transactions it belongs to
CREATE VIEW address_tx_network_fourth_view AS
SELECT
  hatlv.address_id,
  MIN(tniv.network) AS network
FROM
  hd_address_tx_logic_view hatlv
LEFT JOIN
  tx_network_fourth_view tniv ON tniv.tx_id = hatlv.tx_id
GROUP BY
  hatlv.address_id;

-- Then go BACK and fill in the minimum addresses to the initial txes
CREATE VIEW tx_network_fifth_view AS
SELECT
  hatlv.tx_id,
  MIN(atnv.network) AS network
FROM
  hd_address_tx_logic_view hatlv
JOIN
  address_tx_network_fourth_view atnv ON atnv.address_id = hatlv.address_id
GROUP BY
  hatlv.tx_id;

-- Now find the lowest networks from all of the transactions it belongs to
CREATE MATERIALIZED VIEW address_tx_network_fifth_view AS
SELECT
  hatlv.address_id,
  MIN(tnsv.network) AS network
FROM
  hd_address_tx_logic_view hatlv
LEFT JOIN
  tx_network_fifth_view tnsv ON tnsv.tx_id = hatlv.tx_id
GROUP BY
  hatlv.address_id;

CREATE UNIQUE INDEX address_tx_network_fifth_view_address_id_idx ON address_tx_network_fifth_view (address_id);
CREATE INDEX address_tx_network_fifth_view_network_idx ON address_tx_network_fifth_view (network);

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
      address_tx_network_fifth_view
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
    address_tx_network_fifth_view atnv
  INNER JOIN
    network_chain nc ON nc.address_id = atnv.network
)
SELECT
  a.address_id,
  CASE WHEN nc.network IS NOT NULL THEN nc.network ELSE a.address_id END AS network
FROM
  address a
LEFT JOIN (
  SELECT
    nc.*
  FROM
    network_chain nc
) AS nc ON nc.address_id = a.address_id;

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


-- Assign identifiers: owners (trex, polo, dev fund, genesis); types (mining, pool ticket, solo ticket)
CREATE VIEW address_owner_identifiers_view AS
SELECT
  sq.address_id,
  sq.owner 
FROM (
  SELECT
    anv.address_id,
    'Dev Fund' AS owner
  FROM
    address_network_view anv
  JOIN
    address a_this ON a_this.address = 'Dcur2mcGjmENx4DhNqDctW5wJCVyT3Qeqkx'
  JOIN
    address_network_view anv_this ON anv_this.address_id = a_this.address_id
  WHERE
    anv.network = anv_this.network
  UNION
  SELECT
    anv.address_id,
    'Bittrex' AS owner
  FROM
    address_network_view anv
  JOIN
    address a_this ON a_this.address = 'DsYyjn3CibRn3Bs3GxtxdBNyrwmENSbwA5Y'
  JOIN
    address_network_view anv_this ON anv_this.address_id = a_this.address_id
  WHERE
    anv.network = anv_this.network
  UNION
  SELECT
    anv.address_id,
    'Poloniex' AS owner
  FROM
    address_network_view anv
  JOIN
    address a_this ON a_this.address = 'DsatEqTNTh5RZHWrSLzS8e3QVNmE1U7iYAL'
  JOIN
    address_network_view anv_this ON anv_this.address_id = a_this.address_id
  WHERE
    anv.network = anv_this.network
  UNION
  SELECT
    anv_c0_hd.address_id,
    'Company 0' AS owner
  FROM
    vout
  JOIN
    vout_address va ON va.vout_id = vout.vout_id
  JOIN
    address_network_view anv_c0 ON anv_c0.address_id = va.address_id
  JOIN
    address_network_view anv_c0_hd ON anv_c0_hd.network = anv_c0.network
  WHERE
    vout.tx_id = 1 AND vout.value = 5000
) AS sq;

CREATE VIEW address_origin_identifiers_view AS
SELECT
  sq.address_id,
  sq.origin
FROM (
  SELECT
    DISTINCT a.address_id,
    'Mining' AS origin
  FROM
    vin
  JOIN
    vout ON vout.tx_id = vin.tx_id
  JOIN
    vout_address va ON va.vout_id = vout.vout_id
  JOIN
    address a ON a.address_id = va.address_id
  WHERE
    -- We don't want to count the first block, which was an investor / developer distribution
    -- Nor do we count the developer fund
    vin.coinbase != '' AND vin.tx_id > 1 AND a.address != 'Dcur2mcGjmENx4DhNqDctW5wJCVyT3Qeqkx' AND
    a.address_id NOT IN (
      SELECT
        va.address_id
      FROM
        vout
      JOIN
        vout_address va ON va.vout_id = vout.vout_id
      WHERE
        vout.tx_id = 1
    )
  UNION
  SELECT
    va.address_id,
    'Genesis' AS origin
  FROM
    vout
  JOIN
    vout_address va ON va.vout_id = vout.vout_id
  WHERE
    vout.tx_id = 1
) AS sq;

CREATE VIEW address_ticket_identifiers_view AS
SELECT
  sq.address_id,
  sq.ticket
FROM (
  SELECT
    DISTINCT a.address_id,
    'Pool Ticket' AS ticket
  FROM
    vout
  JOIN
    vout_address va ON va.vout_id = vout.vout_id
  JOIN
    address a ON a.address_id = va.address_id
  WHERE
    vout.type = 'stakesubmission' AND a.address LIKE 'Dc%'
  UNION
  SELECT
    DISTINCT a.address_id,
    'Solo Ticket' AS ticket
  FROM
    vout
  JOIN
    vout_address va ON va.vout_id = vout.vout_id
  JOIN
    address a ON a.address_id = va.address_id
  WHERE
    vout.type = 'stakesubmission' AND a.address LIKE 'Ds%'
) AS sq;

CREATE MATERIALIZED VIEW address_identifiers_view AS
SELECT
  a.address_id,
  owner.owner,
  origin.origin,
  ticket.ticket
FROM
  address a
LEFT JOIN
  address_owner_identifiers_view owner ON owner.address_id = a.address_id
LEFT JOIN
  address_origin_identifiers_view origin ON origin.address_id = a.address_id
LEFT JOIN
  address_ticket_identifiers_view ticket ON ticket.address_id = a.address_id;

CREATE UNIQUE INDEX address_identifiers_view_network_idx ON address_identifiers_view (address_id);

-- And create the cached breakdown view of all vouts
CREATE MATERIALIZED VIEW address_vout_breakdown_view AS
SELECT 
  DISTINCT vout.address_id,
  COALESCE(genesis.vout, 0) AS genesis,
  COALESCE(coinbase.vout, 0) AS coinbase,
  COALESCE(stakebase.vout, 0) AS stakebase,
  COALESCE(stakesubmission.vout, 0) AS stakesubmission,
  COALESCE(direct_from_exchange.vout, 0) AS direct_from_exchange
FROM
  vout
LEFT JOIN (
  SELECT address_id, COALESCE(SUM(value), 0) AS vout
  FROM vout
  WHERE tx_id = 1
  GROUP BY address_id
) AS genesis ON genesis.address_id = vout.address_id
LEFT JOIN (
  SELECT address_id, COALESCE(SUM(vout.value), 0) AS vout
  FROM vout
  JOIN tx ON tx.tx_id = vout.tx_id AND tx.tree = 0 AND tx.tx_id != 1 
  JOIN vin ON vin.tx_id = tx.tx_id AND vin.coinbase != ''
  GROUP BY address_id
) AS coinbase ON coinbase.address_id = vout.address_id
LEFT JOIN (
  SELECT address_id, COALESCE(SUM(value), 0) AS vout
  FROM vout
  WHERE vout.type = 'stakegen'
  GROUP BY address_id
) AS stakebase ON stakebase.address_id = vout.address_id
LEFT JOIN (
  SELECT address_id, COALESCE(SUM(value), 0) AS vout
  FROM vout
  WHERE vout.type = 'stakesubmission'
  GROUP BY address_id
) AS stakesubmission ON stakesubmission.address_id = vout.address_id
LEFT JOIN (
  SELECT
    sq.address_id,
    SUM(COALESCE(sq.value, 0)) AS vout
  FROM (
    SELECT DISTINCT ON (this.address_id, vout.vout_id) this.address_id, vout.value
    FROM address this
    JOIN vout ON vout.address_id = this.address_id
    JOIN vin ON vin.tx_id = vout.tx_id 
    JOIN vout origin_vout ON origin_vout.vout_id = vin.vout_id
    JOIN address origin_address ON 
      origin_address.address_id = origin_vout.address_id AND 
      origin_address.identifier IN ('Poloniex', 'Bittrex')
    WHERE this.identifier NOT IN ('Poloniex', 'Bittrex')
  ) AS sq
  GROUP BY sq.address_id
) AS direct_from_exchange ON direct_from_exchange.address_id = vout.address_id;

CREATE UNIQUE INDEX address_vout_breakdown_view_network_idx ON address_vout_breakdown_view (address_id);
