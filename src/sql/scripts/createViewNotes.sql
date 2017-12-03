SELECT
  sq.address_id,
  sq.vout,
  sq.vin,
  sq.vout - sq.vin AS balance
FROM (
  SELECT 
    sq.address_id,
    sq.vout,
    sq2.vin
  FROM (
    SELECT
      address_id,
      coalesce(sum(coalesce(value, 0)), 0) AS vout
    FROM
      vout
    GROUP BY
      address_id
  ) AS sq
  LEFT JOIN (
    SELECT
      va.address_id,
      coalesce(sum(coalesce(vin.amountin, 0)), 0) AS vin
    FROM
      vout_address va
    JOIN
      vin ON vin.vout_id = va.vout_id
    GROUP BY
      va.address_id
  ) AS sq2 ON sq2.address_id = sq.address_id
) AS sq;

SELECT 
  sq.address_id,
  sq.vout,
  sq2.vin,
  sq3.rtx,
  sq3.stx
FROM (
  SELECT
    address_id,
    coalesce(sum(coalesce(value, 0)), 0) AS vout
  FROM
    vout
  GROUP BY
    address_id
) AS sq
LEFT JOIN (
  SELECT
    va.address_id,
    coalesce(sum(coalesce(vin.amountin, 0)), 0) AS vin
  FROM
    vout_address va
  JOIN
    vin ON vin.vout_id = va.vout_id
  GROUP BY
    va.address_id
) AS sq2 ON sq2.address_id = sq.address_id
LEFT JOIN (
  SELECT
    vout.address_id,
    count(distinct rtx.tx_id) AS rtx,
    count(distinct stx.tx_id) AS stx
  FROM
    vout
  LEFT JOIN
    vin ON vin.vout_id = vout.vout_id
  LEFT JOIN 
    tx rtx ON (rtx.tx_id = vout.tx_id OR rtx.tx_id = vin.tx_id) AND rtx.tree = 0
  LEFT JOIN 
    tx stx ON (stx.tx_id = vout.tx_id OR stx.tx_id = vin.tx_id) AND stx.tree = 1
  GROUP BY
    vout.address_id
) AS sq3 ON sq3.address_id = sq.address_id;

