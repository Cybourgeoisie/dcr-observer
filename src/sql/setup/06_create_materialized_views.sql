--------------------
-- Clear Errthang --
--------------------

DROP MATERIALIZED VIEW IF EXISTS address_vout_vin_view CASCADE;
DROP VIEW IF EXISTS address_rtx_view CASCADE;
DROP VIEW IF EXISTS address_stx_view CASCADE;
DROP VIEW IF EXISTS address_block_activity_view CASCADE;
DROP VIEW IF EXISTS address_actively_staking_view CASCADE;
DROP MATERIALIZED VIEW IF EXISTS address_rtx_view CASCADE;
DROP MATERIALIZED VIEW IF EXISTS address_stx_view CASCADE;
DROP MATERIALIZED VIEW IF EXISTS address_block_activity_view CASCADE;
DROP MATERIALIZED VIEW IF EXISTS address_actively_staking_view CASCADE;
DROP MATERIALIZED VIEW IF EXISTS tx_network_initial_view CASCADE;
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

CREATE VIEW address_rtx_view AS
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

--CREATE UNIQUE INDEX address_rtx_view_address_id_idx ON address_rtx_view (address_id);

CREATE VIEW address_stx_view AS
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

--CREATE UNIQUE INDEX address_stx_view_address_id_idx ON address_stx_view (address_id);

CREATE VIEW address_block_activity_view AS
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

--CREATE UNIQUE INDEX address_block_activity_view_address_id_idx ON address_block_activity_view (address_id);

-- Determine if an address is actively staking
CREATE VIEW address_actively_staking_view AS
SELECT
  DISTINCT va.address_id
FROM
  vout
LEFT JOIN
  vin next_vin ON next_vin.vout_id = vout.vout_id
JOIN
  vin sender_vin ON sender_vin.tx_id = vout.tx_id
JOIN
  vout_address va ON va.vout_id = sender_vin.vout_id
WHERE
  vout.type = 'stakesubmission' AND next_vin.vin_id IS NULL;

--CREATE INDEX address_actively_staking_view_address_id_idx ON address_actively_staking_view (address_id);

-- Now combine them all
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
  RANK() OVER(ORDER BY abv.liquid_balance DESC) AS liquid_rank,
  RANK() OVER(ORDER BY abv.stakesubmission_balance DESC) AS stakesubmission_rank,
  COALESCE(artxv.rtx, 0) + COALESCE(astxv.stx, 0) AS tx,
  artxv.rtx,
  astxv.stx,
  abav.first_block_id,
  abav.last_block_id,
  CASE WHEN (aasv.address_id IS NOT NULL) THEN true ELSE false END AS actively_staking
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
  address_actively_staking_view aasv ON aasv.address_id = avvv.address_id;

CREATE UNIQUE INDEX address_summary_view_address_id_idx ON address_summary_view (address_id);
CREATE INDEX address_summary_view_rank_idx ON address_summary_view (rank);
CREATE INDEX address_summary_view_liquid_rank_idx ON address_summary_view (liquid_rank);
CREATE INDEX address_summary_view_stakesubmission_rank_idx ON address_summary_view (stakesubmission_rank);


-----------------
-- HD Networks --
-----------------

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

--CREATE INDEX address_tx_network_initial_view_address_id_idx ON address_tx_network_initial_view (address_id);
--CREATE INDEX address_tx_network_initial_view_network_idx ON address_tx_network_initial_view (network);

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
  MIN(asv.last_block_id) AS last_block_id
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
  RANK() OVER(ORDER BY nbv.liquid_balance DESC) AS liquid_rank,
  RANK() OVER(ORDER BY nbv.stakesubmission_balance DESC) AS stakesubmission_rank,
  ntav.address_id AS primary_address_id
FROM
  network_balance_view nbv, network_top_address_view ntav
WHERE
  ntav.network = nbv.network;

CREATE UNIQUE INDEX network_summary_view_network_idx ON network_summary_view (network);
CREATE INDEX network_summary_view_rank_idx ON network_summary_view (rank);
CREATE INDEX network_summary_view_liquid_rank_idx ON network_summary_view (liquid_rank);
CREATE INDEX network_summary_view_stakesubmission_rank_idx ON network_summary_view (stakesubmission_rank);

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
