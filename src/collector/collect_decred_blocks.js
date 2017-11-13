var fs     = require('fs');
var shell  = require('shelljs');
var dcrd   = '~/go/bin/dcrd';
var dcrctl = '~/go/bin/dcrctl';

// Validate that we have the tools
if (!shell.which(dcrd) || !shell.which(dcrctl)) {
	shell.echo('Sorry, this script requires dcrd and dcrctl');
	shell.exit(1);
}

// Get all top addresses
var savefile = "../../../dcr_parser_save_file.json";
var blockdir = '../../../blocks/';

// If we have a save state, use it
fs.exists(savefile, function(exists) {
	if (!exists) {
		startAtBeginning()
	} else {
		console.log("Using save state.");
		fs.readFile(savefile, function(err, data) {
			if (err) {
				console.log("Could not read save state file.");
				process.exit();
			} else {
				// Pull the save state and restore
				var save_state = JSON.parse(data);

				// Report height
				console.log("Starting at height " + save_state.height + ".");

				// Now process the blocks
				processBlocks(save_state.height, save_state.nextblockhash);
			}
		});
	}
});

function startAtBeginning() {
	shell.exec(dcrctl + ' getblockhash 1', {'silent':true}, function(code, stdout, stderr) {
		verify(code,stdout,stderr);

		// Now start collecting transactions
		var starting_block_hash = stdout;
		console.log("Starting at beginning, from hash " + starting_block_hash.trim());
		processBlocks(0, starting_block_hash);
	});
}

function processBlocks(height, next_block_hash) {
	if (height == null || !next_block_hash) {
		console.log("Invalid height and block hash to process blocks.");
		process.exit();
	}

	var current_block_hash = "";
	while (next_block_hash) {
		if (height % 250 == 0) {
			saveProgress(height, next_block_hash);
		}

		// Store as the current block hash & height
		current_block_hash = next_block_hash;
		height++;

		// Collect all transactions and move to the next block
		next_block_hash = collectTransactionsAtBlock(current_block_hash);
	}

	// Save the final state
	console.log("Reached end.");
	saveProgress(height-1, current_block_hash);
	// height-1 since we incremented before, prior to validating that the height was legitimate
	// We want to redo the last block, since it'll have a new "nextblockhash" to take us to
	// the following block
}

function saveProgress(height, next_block_hash) {
	console.log("At height " + height + ". Saving state.");

	// Save our current state
	var save_state = {
		'height' : height,
		'nextblockhash' : next_block_hash
	};

	var save_state_json = JSON.stringify(save_state);
	fs.writeFileSync(savefile, save_state_json);
}


function verify(code, stdout, stderr) {
	if (code < 0) {
		shell.echo('Invalid response.\nCode: ' + code + '\nOut: ' + stdout + '\nError: ' + stderr);
		shell.exit(1);
		process.exit();
	}
}

function collectTransactionsAtBlock(block_hash) {
	// Collect the first block
	var cmd      = dcrctl + ' getblock "' + block_hash.trim() + '" 1 1';
	var getblock = shell.exec(cmd, {'silent':true});
	var code     = getblock.code;
	var stdout   = getblock.stdout;
	var stderr   = getblock.stderr;

	verify(code,stdout,stderr);

	// Collect all transactions
	var block = JSON.parse(stdout);
	var rawtxes = block["rawtx"];
	var rawstxes = block["rawstx"];

	// Store parts of the block
	var reduced_block = {
		'hash' : block.hash.trim(),
		'height' : block.height,
		'version' : block.version,
		'merkleroot' : block.merkleroot,
		'stakeroot' : block.stakeroot,
		'rawtx' : [],
		'rawstx' : [],
		'time' : block.time,
		'stakeversion' : block.stakeversion,
		'extradata' : block.extradata,
		'votebits' : block.votebits,
		'finalstate' : block.finalstate,
		'voters' : block.voters,
		'freshstake' : block.freshstake,
		'revocations' : block.revocations,
		'poolsize' : block.poolsize,
		'bits' : block.bits,
		'sbits' : block.sbits
	};

	for (var i = 0; i < rawtxes.length; i++) {
		// Get information about the transaction
		var tx = rawtxes[i];

		// Store parts of the raw tx
		var reduced_tx = {
			'txid' : tx.txid.trim(),
			'version' : tx.version,
			'locktime' : tx.locktime,
			'expiry' : tx.expiry,
			'vin' : tx.vin,
			'vout' : tx.vout
		};
		reduced_block.rawtx.push(reduced_tx);
	}

	if (rawstxes)
	{
		for (var i = 0; i < rawstxes.length; i++) {
			// Get information about the transaction
			var tx = rawstxes[i];

			// Store parts of the raw tx
			var reduced_tx = {
				'txid' : tx.txid.trim(),
				'version' : tx.version,
				'locktime' : tx.locktime,
				'expiry' : tx.expiry,
				'vin' : tx.vin,
				'vout' : tx.vout
			};
			reduced_block.rawstx.push(reduced_tx);
		}
	}

	// Determine where to save this file
	var blockheight = parseInt(block.height);
	var blocksubdir = "blocks_" + (Math.trunc(blockheight/1000)*1000) + "_" + (Math.trunc(blockheight/1000)*1000 + 999) + "/";
	var folder      = blockdir + blocksubdir;
	var location    = folder + "block_" + blockheight + ".json";

	// If we don't have a subdirectory, create it
	if (!fs.existsSync(folder)) {
		shell.mkdir(folder);
	}

	// Save the block to a file
	fs.writeFileSync(location, JSON.stringify(reduced_block));

	// Move on to the next block
	return (block.hasOwnProperty('nextblockhash')) ? block.nextblockhash : null;
}
