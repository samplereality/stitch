<?php
declare(strict_types=1);

require_once __DIR__ . "/auth.php";

header("Content-Type: application/json; charset=utf-8");

if ($_SERVER["REQUEST_METHOD"] !== "POST") {
    http_response_code(405);
    echo json_encode(["ok" => false, "error" => "Method not allowed."]);
    exit;
}

logoutUser();
echo json_encode(["ok" => true]);
