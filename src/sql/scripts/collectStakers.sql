BEGIN;

-- I don't think this is very helpful.
-- We should be highlighting miners, but stakers are normal addresses.
-- We should, however, identify staking pools

--UPDATE
--  address
--SET
--  identifier = 'Staking'
--FROM (
--  SELECT
--    DISTINCT a.address_id
--  FROM
--    vin
--  JOIN
--    vout ON vout.tx_id = vin.tx_id
--  JOIN
--    vout_address va ON va.vout_id = vout.vout_id
--  JOIN
--    address a ON a.address_id = va.address_id
--  WHERE
--    vin.stakebase != ''
--  GROUP BY
--    a.address_id
--) AS sq
--WHERE
--  address.address_id = sq.address_id;

ROLLBACK;
