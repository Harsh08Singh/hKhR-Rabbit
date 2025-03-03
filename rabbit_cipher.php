<?php
// rabbit_cipher.php - PHP wrapper for the Rabbit cipher C implementation
header("Access-Control-Allow-Origin: *"); // Allows all origins (use specific domains for security)
header("Access-Control-Allow-Methods: POST, GET, OPTIONS"); // Allowed request methods
header("Access-Control-Allow-Headers: Content-Type, Authorization"); // Allowed headers
// Set headers for JSON response
header('Content-Type: application/json');

// Enable error reporting for debugging
ini_set('display_errors', 1);
ini_set('display_startup_errors', 1);
error_reporting(E_ALL);

// Get the POST parameters
$action = isset($_POST['action']) ? $_POST['action'] : '';
$key = isset($_POST['key']) ? $_POST['key'] : '';
$iv = isset($_POST['iv']) ? $_POST['iv'] : '';
$message = isset($_POST['message']) ? $_POST['message'] : '';
$hexData = isset($_POST['hexData']) ? $_POST['hexData'] : '';
$vizType = isset($_POST['vizType']) ? $_POST['vizType'] : 'decrypt'; // Default to decrypt for backward compatibility

// Helper function for better error responses
function returnError($message, $debugInfo = null) {
    $response = ['error' => $message];
    if ($debugInfo !== null) {
        $response['debug'] = $debugInfo;
    }
    echo json_encode($response);
    exit;
}

// Validate hex string format (pairs of hex digits separated by spaces)
function validateHexBytes($input, $expectedLength = null) {
    if (!preg_match('/^([0-9A-Fa-f]{2}\s)*[0-9A-Fa-f]{2}$/', $input)) {
        return false;
    }
    
    $bytes = explode(' ', $input);
    return $expectedLength === null || count($bytes) === $expectedLength;
}

// Convert hex string to binary data
function hexToBinary($hexString) {
    $bytes = explode(' ', $hexString);
    $binary = '';
    foreach ($bytes as $byte) {
        $binary .= chr(hexdec($byte));
    }
    return $binary;
}

// Convert binary data to hex string
function binaryToHex($binary) {
    $hex = [];
    for ($i = 0; $i < strlen($binary); $i++) {
        $hex[] = strtoupper(bin2hex($binary[$i]));
    }
    return implode(' ', $hex);
}

// Function to execute a command and capture both output and error
function executeCommand($command) {
    $descriptorspec = array(
        0 => array("pipe", "r"),  // stdin
        1 => array("pipe", "w"),  // stdout
        2 => array("pipe", "w")   // stderr
    );
    
    $process = proc_open($command, $descriptorspec, $pipes);
    
    if (!is_resource($process)) {
        return array(
            'success' => false,
            'stdout' => null,
            'stderr' => 'Failed to execute command',
            'returnCode' => -1
        );
    }
    
    // Read stdout and stderr
    $stdout = stream_get_contents($pipes[1]);
    $stderr = stream_get_contents($pipes[2]);
    
    // Close all pipes
    fclose($pipes[0]);
    fclose($pipes[1]);
    fclose($pipes[2]);
    
    // Close process and get return value
    $returnCode = proc_close($process);
    
    return array(
        'success' => $returnCode === 0,
        'stdout' => $stdout,
        'stderr' => $stderr,
        'returnCode' => $returnCode
    );
}

// Determine the correct path to the executable
$os = PHP_OS;
$isWindows = (strtoupper(substr($os, 0, 3)) === 'WIN');
$executablePath = $isWindows ? '.\\rabbit_cli' : './rabbit_cli';

// Check if executable exists
if (!file_exists($executablePath)) {
    $executablePath = dirname(__FILE__) . DIRECTORY_SEPARATOR . ($isWindows ? 'rabbit_cli.exe' : 'rabbit_cli');
    if (!file_exists($executablePath)) {
        returnError("Executable not found: $executablePath. Tried both relative and absolute paths.");
    }
}

// Prepare temporary files with unique names to avoid collisions
$uniqueId = uniqid();
$tempDir = sys_get_temp_dir();
$keyFile = $tempDir . DIRECTORY_SEPARATOR . 'rabbit_key_' . $uniqueId . '.bin';
$ivFile = $tempDir . DIRECTORY_SEPARATOR . 'rabbit_iv_' . $uniqueId . '.bin';
$inputFile = $tempDir . DIRECTORY_SEPARATOR . 'rabbit_input_' . $uniqueId . '.bin';
$outputFile = $tempDir . DIRECTORY_SEPARATOR . 'rabbit_output_' . $uniqueId . '.bin';
$vizFile = $tempDir . DIRECTORY_SEPARATOR . 'rabbit_viz_' . $uniqueId . '.txt';

// Register cleanup function to ensure temporary files are removed
register_shutdown_function(function() use ($keyFile, $ivFile, $inputFile, $outputFile, $vizFile) {
    foreach ([$keyFile, $ivFile, $inputFile, $outputFile, $vizFile] as $file) {
        if (file_exists($file)) {
            @unlink($file);
        }
    }
});

// Validate request
if (empty($action)) {
    returnError('No action specified');
}

// Validate key and IV
if (!validateHexBytes($key, 16)) {
    returnError('Invalid key format. Must be 16 bytes in hex format.');
}

if (!validateHexBytes($iv, 8)) {
    returnError('Invalid IV format. Must be 8 bytes in hex format.');
}

// Write key and IV to binary files
file_put_contents($keyFile, hexToBinary($key));
file_put_contents($ivFile, hexToBinary($iv));

// Process based on action
switch ($action) {
    case 'encrypt':
        if (empty($message)) {
            returnError('No message to encrypt');
        }
        
        // Write message to file
        file_put_contents($inputFile, $message);
        
        // Execute the rabbit cipher command for encryption with visualization
        $command = sprintf('"%s" encrypt "%s" "%s" "%s" "%s" "%s"',
            $executablePath, $keyFile, $ivFile, $inputFile, $outputFile, $vizFile);
        
        $result = executeCommand($command);
        
        if (!$result['success']) {
            returnError('Encryption failed', [
                'command' => $command,
                'stdout' => $result['stdout'],
                'stderr' => $result['stderr'],
                'returnCode' => $result['returnCode'],
                'executableExists' => file_exists($executablePath),
                'executablePath' => $executablePath,
                'cwd' => getcwd()
            ]);
        }
        
        // Check if output file exists and has content
        if (!file_exists($outputFile) || filesize($outputFile) === 0) {
            returnError('Output file is empty or not created', [
                'command' => $command,
                'stdout' => $result['stdout'],
                'stderr' => $result['stderr'],
                'outputFile' => $outputFile,
                'exists' => file_exists($outputFile),
                'size' => file_exists($outputFile) ? filesize($outputFile) : 'N/A'
            ]);
        }
        
        // Read the encrypted data
        $encryptedData = file_get_contents($outputFile);
        $hexEncrypted = binaryToHex($encryptedData);
        
        // Read visualization data if available
        $vizOutput = file_exists($vizFile) ? file_get_contents($vizFile) : null;
        
        $response = ['result' => $hexEncrypted];
        if ($vizOutput !== null) {
            $response['visualization'] = $vizOutput;
        }
        
        echo json_encode($response);
        break;
        
    case 'decrypt':
        if (empty($hexData)) {
            returnError('No data to decrypt');
        }
        
        if (!validateHexBytes($hexData)) {
            returnError('Invalid hex data format');
        }
        
        // Convert hex to binary and write to file
        file_put_contents($inputFile, hexToBinary($hexData));
        
        // Execute the rabbit cipher command for decryption with visualization
        $command = sprintf('"%s" decrypt "%s" "%s" "%s" "%s" "%s"',
            $executablePath, $keyFile, $ivFile, $inputFile, $outputFile, $vizFile);
        
        $result = executeCommand($command);
        
        if (!$result['success']) {
            returnError('Decryption failed', [
                'command' => $command,
                'stdout' => $result['stdout'],
                'stderr' => $result['stderr'],
                'returnCode' => $result['returnCode']
            ]);
        }
        
        // Read the decrypted data
        $decryptedText = file_get_contents($outputFile);
        
        // Read visualization data if available
        $vizOutput = file_exists($vizFile) ? file_get_contents($vizFile) : null;
        
        $response = ['result' => $decryptedText];
        if ($vizOutput !== null) {
            $response['visualization'] = $vizOutput;
        }
        
        echo json_encode($response);
        break;
        
    case 'visualize':
        // Validate visualization type
        if ($vizType !== 'encrypt' && $vizType !== 'decrypt') {
            $vizType = 'decrypt'; // Default to decrypt if invalid
        }
        
        // Use either provided message or hex data based on visualization type
        if ($vizType === 'encrypt') {
            // For encryption visualization, use the plain message
            if (empty($message)) {
                $message = 'Test message'; // Default message
            }
            file_put_contents($inputFile, $message);
        } else {
            // For decryption visualization, use the hex data
            if (empty($hexData) && empty($message)) {
                // If neither is provided, use a default message
                $message = 'Test message';
                file_put_contents($inputFile, $message);
            } else if (!empty($hexData)) {
                // Use provided hex data for decryption visualization
                if (!validateHexBytes($hexData)) {
                    returnError('Invalid hex data format');
                }
                file_put_contents($inputFile, hexToBinary($hexData));
            } else {
                // Use provided message as fallback
                file_put_contents($inputFile, $message);
            }
        }
        
        // Execute the rabbit cipher command with visualization
        $command = sprintf('"%s" visualize "%s" "%s" "%s" "%s" "%s"',
            $executablePath, $keyFile, $ivFile, $inputFile, $vizFile, $vizType);
        
        $result = executeCommand($command);
        
        if (!$result['success']) {
            returnError('Visualization failed', [
                'command' => $command,
                'stdout' => $result['stdout'],
                'stderr' => $result['stderr'],
                'returnCode' => $result['returnCode'],
                'vizType' => $vizType
            ]);
        }
        
        // Read the visualization data
        if (file_exists($vizFile)) {
            $vizOutput = file_get_contents($vizFile);
            echo json_encode([
                'result' => $vizOutput,
                'vizType' => $vizType // Include visualization type in response
            ]);
        } else {
            returnError('Visualization file not created', [
                'command' => $command,
                'stdout' => $result['stdout'],
                'stderr' => $result['stderr'],
                'vizFile' => $vizFile,
                'vizType' => $vizType
            ]);
        }
        break;
        
    default:
        returnError('Invalid action');
}
?>