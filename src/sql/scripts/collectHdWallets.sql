
-- TWO STEP PROCESS, ITERATIVELY REPEATED FOR BETTER RESULTS

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
    GROUP BY
        va.address_id
) as sq
WHERE
    address.address_id = sq.address_id;

-- THEN RINSE AND REPEAT --
---------------------------


-- (1b) Get all sstxcommitments, but only for transactions with a single sstxcommitment 
-- (to avoid confusion with multisigs used for stakepools),
-- set to lowest network, store to tx network
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
        vout ON vout.tx_id = tx.tx_id AND (vout.type = 'sstxcommitment' OR vout.type = 'sstxchange')
    JOIN
        vin ON vin.tx_id = tx.tx_id
    JOIN
        vout_address va ON va.vout_id = vin.vout_id OR va.vout_id = vout.vout_id
    JOIN
        address a ON a.address_id = va.address_id
    WHERE
        tx.tree = 1 -- SSTX only
        AND 
    GROUP BY
        tx.tx_id
    ORDER BY
        tx.tx_id
) as sq
WHERE
    tx_network.tx_id = sq.tx_id;



-------------------------------------
-- And then update the identifiers --

-- Now identify all wallets connected to known miners and exchanges
UPDATE
    address
SET
    identifier = COALESCE(address.identifier, sq.identifier, '')
FROM (
    SELECT
        DISTINCT ON (a.network)
        a.network,
        a.identifier
    FROM
        address a
    JOIN
        balance b ON b.address_id = a.address_id
    WHERE
        a.identifier != ''
    ORDER BY
        a.network, b.balance DESC
) AS sq
WHERE
    address.network = sq.network;


-- ALTERNATIVE: one table
-- Get all tx / address pairs, set to lowest network
--UPDATE
--    address
--SET
--    network = sq.network
--FROM (
--    SELECT
--        va.address_id,
--        min(sq.network) AS network
--    FROM (
--        SELECT
--            tx.tx_id,
--            min(a.network) AS network
--        FROM
--            tx
--        JOIN
--            vin ON vin.tx_id = tx.tx_id
--        JOIN
--            vout_address va ON va.vout_id = vin.vout_id
--        JOIN
--            address a ON a.address_id = va.address_id
--        GROUP BY
--            tx.tx_id
--        ORDER BY
--            tx.tx_id
--    ) AS sq
--    JOIN
--        vin ON vin.tx_id = sq.tx_id
--    JOIN
--        vout_address va ON va.vout_id = vin.vout_id
--    GROUP BY
--        va.address_id
--) as sq
--WHERE
--    address.address_id = sq.address_id;
