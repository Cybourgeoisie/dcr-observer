BEGIN;

UPDATE
  address
SET
  identifier = 'Mining'
FROM (
  SELECT
    DISTINCT a.address_id
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
    vin.coinbase != '' AND vin.tx_id > 1 AND a.address != 'Dcur2mcGjmENx4DhNqDctW5wJCVyT3Qeqkx'
  GROUP BY
    a.address_id
) AS sq
WHERE
  address.address_id = sq.address_id;


--SELECT
--	DISTINCT a.address,
--	SUM(COALESCE(vout.value, 0)) AS value
--FROM
--	vin
--JOIN
--	vout ON vout.tx_id = vin.tx_id
--JOIN
--	vout_address va ON va.vout_id = vout.vout_id
--JOIN
--	address a ON a.address_id = va.address_id
--WHERE
--	-- We don't want to count the first block, which was an investor / developer distribution
--	vin.coinbase != '' AND vin.tx_id > 1
--GROUP BY
--	a.address
--ORDER BY
--	value DESC;

ROLLBACK;
