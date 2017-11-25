SELECT
-- All TX inputs
(SELECT COALESCE(SUM(vout.value), 0) 
FROM address a 
JOIN vout_address va ON va.address_id = a.address_id 
JOIN vout ON vout.vout_id = va.vout_id 
JOIN tx ON tx.tx_id = vout.tx_id AND tx.tree = 0 WHERE a.address = 'DsS5puNwsxaF9HQCSkgg5fLf1cGc1orabMP') AS vout,
-- All coinbase inputs (mining), except the genesis block
(SELECT COALESCE(SUM(vout.value), 0) 
FROM address a 
JOIN vout_address va ON va.address_id = a.address_id 
JOIN vout ON vout.vout_id = va.vout_id 
JOIN tx ON tx.tx_id = vout.tx_id AND tx.tree = 0 AND tx.tx_id != 1 
JOIN vin ON vin.tx_id = tx.tx_id AND vin.coinbase != '' WHERE a.address = 'DsS5puNwsxaF9HQCSkgg5fLf1cGc1orabMP') AS coinbase,
-- All stakegen inputs
(SELECT COALESCE(SUM(vout.value), 0)
FROM address a 
JOIN vout_address va ON va.address_id = a.address_id 
JOIN vout ON vout.vout_id = va.vout_id AND vout.type = 'stakegen' WHERE a.address = 'DsS5puNwsxaF9HQCSkgg5fLf1cGc1orabMP') AS stakebase,
-- All stakesubmission inputs
(SELECT COALESCE(SUM(vout.value), 0)
FROM address a 
JOIN vout_address va ON va.address_id = a.address_id 
JOIN vout ON vout.vout_id = va.vout_id AND vout.type = 'stakesubmission' WHERE a.address = 'DsS5puNwsxaF9HQCSkgg5fLf1cGc1orabMP') AS stakesubmission,
-- All inputs directly from the genesis block
(SELECT COALESCE(SUM(vout.value), 0)
FROM address a 
JOIN vout_address va ON va.address_id = a.address_id 
JOIN vout ON vout.vout_id = va.vout_id AND vout.tx_id = 1 WHERE a.address = 'DsS5puNwsxaF9HQCSkgg5fLf1cGc1orabMP') AS genesis,
-- All inputs coming from a genesis block address, except those that come back from a genesis block tx this address already has
(SELECT COALESCE(SUM(vout.value), 0)
FROM address a 
JOIN vout_address va ON va.address_id = a.address_id 
JOIN vout ON vout.vout_id = va.vout_id
JOIN vin ON vin.tx_id = vout.tx_id 
JOIN vout origin_vout ON origin_vout.vout_id = vin.vout_id AND origin_vout.tx_id = 1
JOIN vout_address origin_vout_address ON origin_vout_address.vout_id = origin_vout.vout_id
JOIN address origin_address ON origin_address.address_id = origin_vout_address.address_id
WHERE a.address = 'DsS5puNwsxaF9HQCSkgg5fLf1cGc1orabMP' AND
origin_address.address != 'DsS5puNwsxaF9HQCSkgg5fLf1cGc1orabMP') AS paid_from_genesis,
-- All inputs coming from an exchange
(SELECT COALESCE(SUM(vout.value), 0)
FROM address a 
JOIN vout_address va ON va.address_id = a.address_id 
JOIN vout ON vout.vout_id = va.vout_id 
JOIN vin ON vin.tx_id = vout.tx_id 
JOIN vout_address origin_vout_address ON origin_vout_address.vout_id = vin.vout_id
JOIN address origin_address ON origin_address.address_id = origin_vout_address.address_id AND origin_address.identifier IN ('Poloniex', 'Bittrex')
WHERE a.address = 'DsS5puNwsxaF9HQCSkgg5fLf1cGc1orabMP') AS direct_from_exchange,
-- All inputs coming from a miner
(SELECT COALESCE(SUM(vout.value), 0)
FROM address a 
JOIN vout_address va ON va.address_id = a.address_id 
JOIN vout ON vout.vout_id = va.vout_id 
JOIN vin ON vin.tx_id = vout.tx_id 
JOIN vout_address origin_vout_address ON origin_vout_address.vout_id = vin.vout_id
JOIN address origin_address ON origin_address.address_id = origin_vout_address.address_id AND origin_address.identifier = 'Mining'
WHERE a.address = 'DsS5puNwsxaF9HQCSkgg5fLf1cGc1orabMP') AS direct_from_miner;



SELECT DISTINCT vout.type, SUM(vout.value), SUM(COALESCE(vout.commitamt, 0)), COUNT(vout.vout_id) FROM address a JOIN vout_address va ON va.address_id = a.address_id JOIN vout ON vout.vout_id = va.vout_id JOIN tx ON tx.tx_id = vout.tx_id AND tx.tree = 1 WHERE a.address = 'DsS5puNwsxaF9HQCSkgg5fLf1cGc1orabMP' GROUP BY vout.type;

SELECT SUM(vin.amountin) FROM address a 
JOIN vout_address va ON va.address_id = a.address_id 
JOIN vin ON vin.vout_id = va.vout_id 
JOIN tx ON tx.tx_id = vin.tx_id AND tx.tree = 1
WHERE a.address = 'DsS5puNwsxaF9HQCSkgg5fLf1cGc1orabMP';


-- Get all stakesubmissions currently open
SELECT DISTINCT tx.tx_id, vin.amountin, vout.value FROM address a 
JOIN vout_address va ON va.address_id = a.address_id 
JOIN vin ON vin.vout_id = va.vout_id 
JOIN tx ON tx.tx_id = vin.tx_id AND tx.tree = 1
JOIN vout ON vout.tx_id = tx.tx_id AND type = 'stakesubmission'
LEFT JOIN vin vin_spent ON vin_spent.vout_id = vout.vout_id
WHERE a.address = 'DsS5puNwsxaF9HQCSkgg5fLf1cGc1orabMP' AND vin_spent IS NULL;

SELECT COALESCE(SUM(vout_stxsub.value), 0) FROM address a 
JOIN vout_address va ON va.address_id = a.address_id 
JOIN vout vout_stxcmt ON vout_stxcmt.vout_id = va.vout_id AND vout_stxcmt.type = 'sstxcommitment' 
JOIN tx ON tx.tx_id = vout_stxcmt.tx_id AND tx.tree = 1 
JOIN vout vout_stxsub ON vout_stxsub.tx_id = tx.tx_id AND vout_stxsub.type = 'stakesubmission' 
JOIN vout_address va_stxsub ON va_stxsub.vout_id = vout_stxsub.vout_id AND va_stxsub.address_id != a.address_id
LEFT JOIN vin vin_spent ON vin_spent.vout_id = vout_stxsub.vout_id
WHERE a.address = $1 AND vin_spent IS NULL;

-- Get all stakesubmissions already staked
SELECT DISTINCT tx.tx_id, vin.amountin, vout.value FROM address a 
JOIN vout_address va ON va.address_id = a.address_id 
JOIN vin ON vin.vout_id = va.vout_id 
JOIN tx ON tx.tx_id = vin.tx_id AND tx.tree = 1
JOIN vout ON vout.tx_id = tx.tx_id AND type = 'stakesubmission'
LEFT JOIN vin vin_spent ON vin_spent.vout_id = vout.vout_id
WHERE a.address = 'DsS5puNwsxaF9HQCSkgg5fLf1cGc1orabMP' AND vin_spent IS NOT NULL;


-- Just get all txes with a vout to this address
SELECT origin_vout.tx_id, origin_vout.vout_id, vout.tx_id, vout.vout_id FROM vout
JOIN vout_address va ON va.vout_id = vout.vout_id
JOIN address a ON a.address_id = va.address_id
JOIN tx ON tx.tx_id = vout.tx_id AND tx.tree = 0
JOIN vin ON vin.tx_id = vout.tx_id
LEFT JOIN vout origin_vout ON origin_vout.vout_id = vin.vout_id
WHERE a.address = 'DsbFGk9Nu7c1JKsKLKrCRt2WggP5kBjE3jH'
ORDER BY vout.tx_id, vout.vout_id;

-- Get all vouts with attached txes, either tree, to this address
SELECT origin_vout.tx_id, origin_vout.vout_id, vout.tx_id, vout.vout_id FROM vout
JOIN vout_address va ON va.vout_id = vout.vout_id
JOIN address a ON a.address_id = va.address_id
JOIN tx ON tx.tx_id = vout.tx_id
JOIN vin ON vin.tx_id = vout.tx_id
LEFT JOIN vout origin_vout ON origin_vout.vout_id = vin.vout_id
WHERE a.address = 'Dsk1miSgj5rh3SXBE4AF5yX2oJKeVLQApFS'
ORDER BY vout.tx_id, vout.vout_id;

-- Get all txes, either tree, to this address
SELECT DISTINCT tx.tx_id FROM address a
JOIN vout_address va ON va.address_id = a.address_id
JOIN vout ON vout.vout_id = va.vout_id
LEFT JOIN vin ON vin.vout_id = va.vout_id
JOIN tx ON tx.tx_id = vout.tx_id OR tx.tx_id = vin.tx_id
WHERE a.address = 'Dsk1miSgj5rh3SXBE4AF5yX2oJKeVLQApFS'
ORDER BY tx.tx_id;





      type       |       sum       | count 
-----------------+-----------------+-------
 sstxchange      | 167529.48850296 |  1276
 sstxcommitment  |               0 |  1276
-- stakegen        |   1578.49007597 |   296
-- stakerevoke     |      9.43364826 |     2
 stakesubmission |   8540.06826099 |  1926

-- DsZwNex37wqdVRsNdwiErwU9AM4eUjAgMK4 <- solo staking from cheddar
-- Dct2hJ9PgHDU5zBLyD2DL6ekMDe7kccuvtW <- pool staking from cheddar
-- Dc <- multisig
-- Two stakegens for multisig staking

-- sstxchange <- leftover coinage on buying a ticket
-- sstxcommitment <- "my shit's going here"
-- stakesubmission <- "hold my shit"
-- stakegen <- payback + staking bonus
-- stakerevoke <- nvm