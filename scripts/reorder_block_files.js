var shell = require('shelljs');

for (var i = 1; i <= 184; i++) {
	var num = i * 1000;
	var folder = "./blocks_backup/blocks_" + (num-1000) + "_" + (num-1);

	// Make the folder
	console.log(folder);
	shell.mkdir(folder);

	// Construct all the files to move
	var block_array = [];
	for (var j = num-1000; j <= num; j++) {
		if (j%50==0 && block_array.length > 0) {
			shell.mv(block_array, folder);
			//console.log(block_array);
			block_array = [];
		}

		block_array.push("./blocks_backup/block_" + j + ".json");
	}
}
