<?php

// Include everything
require_once(dirname(realpath(__FILE__)) . '/../server/gateway.php');

// Know where the blocks are
//$block_directory = './blocks/';
$block_directory = './';

if (file_exists($block_directory)) {
	for ($i = 1; $i <= 10000; $i++)
	{
		$subdirectory = 'blocks_' . (intval($i/1000)*1000) . '_' . (intval($i/1000)*1000 + 999) . '/';
		$location = $block_directory . $subdirectory . 'block_' . $i . '.json';

		// Now, for this file, read the file and save the data
		$block_json = file_get_contents($location);
		$block = json_decode($block_json, true);

		// Check to see if this block is already stored
		if (isBlockStored(intval($block['height']))) {
			continue;
		}

		// Add the block
		$block_id = addBlock($block);

		// Now add all transactions, vins, and vouts
		addTransactions($block, $block_id);
	}
}

function addTransactions(array $block, int $block_id)
{
	// For both types of transactions..
	$txes  = $block['rawtx'];
	$stxes = $block['rawstx'];

	// Iterate over all inputs and outputs
	foreach ($txes as $count => $tx) {
		addTransaction($tx, $block_id, 0, $count);
	}

	foreach ($stxes as $count => $stx) {
		addTransaction($stx, $block_id, 1, $count);
	}

	return true;
}

function addTransaction(array $tx, int $block_id, int $tree, int $blockindex)
{
	$sql = '
		INSERT INTO
			tx ("block_id","hash","tree","version","locktime","expiry","blockindex")
		VALUES
			($1,$2,$3,$4,$5,$6,$7)
		RETURNING
			tx_id;
	';

	$db_handler = \Geppetto\DatabaseHandler::init();
	$res = $db_handler->query($sql, array(
		$block_id, $tx['txid'], intval($tree), intval($tx['version']), 
		intval($tx['locktime']), intval($tx['expiry']), $blockindex
	));

	if (empty($res) || !array_key_exists(0, $res) || !array_key_exists('tx_id', $res[0])) {
		throw new Exception('Unable to create tx for block id: ' . $block_id);
	}

	// Now for the transaction, store all the outputs, then all the inputs
	foreach ($tx['vout'] as $vout) {
		addVout($vout, intval($res[0]['tx_id']));
	}

	foreach ($tx['vin'] as $vin) {
		addVin($vin, intval($res[0]['tx_id']));
	}

	return true;
}

function addVin(array $vin, int $tx_id)
{
	// Find the corresponding vout
	$vout_id = null;
	if (array_key_exists('tree', $vin) && array_key_exists('vout', $vin))
	{
		$vout_id = findVoutFromVin(intval($vin['blockheight']), intval($vin['tree']),
			intval($vin['blockindex']), intval($vin['vout']));		
	}

	// Handle edge cases
	if (!array_key_exists("coinbase", $vin)) { $vin["coinbase"] = ''; }
	if (!array_key_exists("stakebase", $vin)) { $vin["stakebase"] = ''; }
	if (!array_key_exists("scriptSig", $vin)) { 
		$vin["scriptSig"] = array('asm' => '', 'hex' => '');
	}
	if (!array_key_exists("asm", $vin["scriptSig"])) { $vin["scriptSig"]["asm"] = ''; }
	if (!array_key_exists("hex", $vin["scriptSig"])) { $vin["scriptSig"]["hex"] = ''; }

	// Coinbase, stakebase
	if ($vout_id && $vout_id > 0)
	{
		$sql = '
			INSERT INTO
				vin ("tx_id", "vout_id", "amountin", "coinbase", "stakebase", 
					"sequence", "asm", "hex")
			VALUES
				($1,$2,$3,$4,$5,$6,$7,$8)
			RETURNING
				vin_id;
		';

		$db_handler = \Geppetto\DatabaseHandler::init();
		$res = $db_handler->query($sql, array(
			$tx_id, $vout_id, $vin["amountin"], $vin["coinbase"], $vin["stakebase"],
			intval($vin["sequence"]), $vin["scriptSig"]["asm"], $vin["scriptSig"]["hex"]
		));
	}
	else
	{
		$sql = '
			INSERT INTO
				vin ("tx_id", "amountin", "coinbase", "stakebase", 
					"sequence", "asm", "hex")
			VALUES
				($1,$2,$3,$4,$5,$6,$7)
			RETURNING
				vin_id;
		';

		$db_handler = \Geppetto\DatabaseHandler::init();
		$res = $db_handler->query($sql, array(
			$tx_id, $vin["amountin"], $vin["coinbase"], $vin["stakebase"],
			intval($vin["sequence"]), $vin["scriptSig"]["asm"], $vin["scriptSig"]["hex"]
		));
	}

	if (empty($res) || !array_key_exists(0, $res) || !array_key_exists('vin_id', $res[0])) {
		throw new Exception('Unable to create vin for tx id: ' . $tx_id);
	}

	return intval($res[0]['vin_id']);
}

function findVoutFromVin(int $blockheight, int $tree, int $blockindex, int $vout)
{
	if ($blockheight === 0) {
		return null;
	}

	$sql = '
		SELECT
			v.vout_id
		FROM
			block b
		JOIN
			tx ON 
				b.block_id = tx.block_id AND 
				tx.tree = $2 AND 
				tx.blockindex = $3
		JOIN
			vout v ON
				v.tx_id = tx.tx_id AND
				v.n = $4
		WHERE
			b.height = $1;
	';

	$db_handler = \Geppetto\DatabaseHandler::init();
	$res = $db_handler->query($sql, array($blockheight, $tree, $blockindex, $vout));

	if (empty($res) || !array_key_exists(0, $res) || !array_key_exists('vout_id', $res[0])) {
		throw new Exception('Unable to find vout from ' . $blockheight . ' -> ' . $tree . ' -> ' . $blockindex . ' -> ' . $vout);
	}

	return intval($res[0]['vout_id']);
}

function addVout(array $vout, int $tx_id)
{
	$sql = '
		INSERT INTO
			vout ("tx_id","value","commitamt","n","version","type","asm","hex","reqSigs")
		VALUES
			($1,$2,$3,$4,$5,$6,$7,$8,$9)
		RETURNING
			vout_id;
	';

	// Handle edge cases
	if (!array_key_exists("commitamt", $vout)) { $vout["commitamt"] = 0; }
	if (!array_key_exists("scriptPubKey", $vout)) { 
		$vout["scriptPubKey"] = array('asm' => '', 'hex' => '', 'type' => '', 'reqSigs' => 0);
	}
	if (!array_key_exists("asm", $vout["scriptPubKey"]))     { $vout["scriptPubKey"]["asm"]     = ''; }
	if (!array_key_exists("hex", $vout["scriptPubKey"]))     { $vout["scriptPubKey"]["hex"]     = ''; }
	if (!array_key_exists("type", $vout["scriptPubKey"]))    { $vout["scriptPubKey"]["type"]    = ''; }
	if (!array_key_exists("reqSigs", $vout["scriptPubKey"])) { $vout["scriptPubKey"]["reqSigs"] = 0; }

	$db_handler = \Geppetto\DatabaseHandler::init();
	$res = $db_handler->query($sql, array(
		$tx_id, $vout["value"], $vout["commitamt"], intval($vout["n"]), intval($vout["version"]),
		$vout["scriptPubKey"]["type"], $vout["scriptPubKey"]["asm"], $vout["scriptPubKey"]["hex"], 
		intval($vout["scriptPubKey"]["reqSigs"])
	));

	if (empty($res) || !array_key_exists(0, $res) || !array_key_exists('vout_id', $res[0])) {
		throw new Exception('Unable to create vout for tx id: ' . $tx_id);
	}

	// Add the addresses & link them to vouts
	if (array_key_exists('addresses', $vout["scriptPubKey"])) {
		foreach ($vout['scriptPubKey']['addresses'] as $address) {
			addAddress($address, intval($res[0]['vout_id']));
		}
	}

	return true;
}

function addAddress(string $address, int $vout_id)
{
	// Make sure we don't already have this address
	$address_id = addressExists($address);
	if ($address_id !== false) {
		// Just add the link then
		return addAddressVoutLink($address_id, $vout_id);
	}

	$sql = '
		INSERT INTO
			address ("address")
		VALUES
			($1)
		RETURNING
			address_id;
	';

	$db_handler = \Geppetto\DatabaseHandler::init();
	$res = $db_handler->query($sql, array($address));

	if (empty($res) || !array_key_exists(0, $res) || !array_key_exists('address_id', $res[0])) {
		throw new Exception('Unable to create address for vout id: ' . $vout_id);
	}

	// Now add the link
	return addAddressVoutLink(intval($res[0]['address_id']), $vout_id);
}

function addAddressVoutLink(int $address_id, int $vout_id)
{
	$sql = '
		INSERT INTO
			vout_address ("vout_id", "address_id")
		VALUES
			($1, $2)
		RETURNING
			vout_address_id;
	';

	$db_handler = \Geppetto\DatabaseHandler::init();
	$res = $db_handler->query($sql, array($vout_id, $address_id));

	if (empty($res) || !array_key_exists(0, $res) || !array_key_exists('vout_address_id', $res[0])) {
		throw new Exception('Unable to create address-to-vout id: ' . $address_id . ' & ' . $vout_id);
	}

	// Now add the link
	return intval($res[0]['vout_address_id']);
}

function addressExists(string $address)
{
	$sql = 'SELECT address_id FROM address WHERE address = $1;';

	$db_handler = \Geppetto\DatabaseHandler::init();
	$res = $db_handler->query($sql, array($address));

	if (empty($res) || !array_key_exists(0, $res) || !array_key_exists('address_id', $res[0])) {
		return false;
	}

	return intval($res[0]['address_id']);
}

function addBlock(array $block)
{
	$sql = '
		INSERT INTO
			block ("hash", "height", "version", "merkleroot", "stakeroot", "time", "stakeversion", "extradata", 
				"votebits", "finalstate", "voters", "freshstake", "revocations", "poolsize", "bits", "sbits")
		VALUES
			($1,$2,$3,$4,$5,TO_TIMESTAMP($6),$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
		RETURNING
			block_id;
	';

	$db_handler = \Geppetto\DatabaseHandler::init();
	$res = $db_handler->query($sql, array(
			$block["hash"], intval($block["height"]), intval($block["version"]), $block["merkleroot"], 
			$block["stakeroot"], $block["time"], $block["stakeversion"], $block["extradata"], 
			intval($block["votebits"]), $block["finalstate"], intval($block["voters"]), $block["freshstake"], 
			intval($block["revocations"]), intval($block["poolsize"]), $block["bits"], $block["sbits"])
	);

	if (empty($res) || !array_key_exists(0, $res) || !array_key_exists('block_id', $res[0])) {
		throw new Exception('Unable to create block #' . $block["height"]);
	}

	return intval($res[0]['block_id']);
}

function isBlockStored(int $height)
{
	$sql = 'SELECT block_id FROM block WHERE height = $1;';

	$db_handler = \Geppetto\DatabaseHandler::init();
	$res = $db_handler->query($sql, array($height));

	if (empty($res) || !array_key_exists(0, $res) || !array_key_exists('block_id', $res[0])) {
		return false;
	}

	return true;
}