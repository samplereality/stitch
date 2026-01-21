<?php
declare(strict_types=1);

require_once __DIR__ . "/auth.php";
require_once __DIR__ . "/projects_helpers.php";

$user = requireRole(["manager"]);
$pdo = db();

function deleteDirectory(string $dir): void {
    if (!is_dir($dir)) {
        return;
    }
    $items = new RecursiveIteratorIterator(
        new RecursiveDirectoryIterator($dir, FilesystemIterator::SKIP_DOTS),
        RecursiveIteratorIterator::CHILD_FIRST
    );
    foreach ($items as $item) {
        if ($item->isDir()) {
            @rmdir($item->getPathname());
        } else {
            @unlink($item->getPathname());
        }
    }
    @rmdir($dir);
}

function flash(string $message): void {
    startSession();
    $_SESSION["flash_message"] = $message;
}

function pullFlash(): string {
    startSession();
    $message = $_SESSION["flash_message"] ?? "";
    unset($_SESSION["flash_message"]);
    return $message;
}

function normalizeEmails(string $raw): array {
    $parts = preg_split("/[\\s,;]+/", $raw) ?: [];
    $emails = [];
    foreach ($parts as $part) {
        $email = trim($part);
        if ($email === "") {
            continue;
        }
        if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
            continue;
        }
        $emails[] = strtolower($email);
    }
    return array_values(array_unique($emails));
}

if ($_SERVER["REQUEST_METHOD"] === "POST") {
    $action = $_POST["action"] ?? "";
    if ($action === "create_user") {
        $email = strtolower(trim((string) ($_POST["email"] ?? "")));
        if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
            flash("Invalid email address.");
        } else {
            $password = generatePassword();
            $hash = password_hash($password, PASSWORD_DEFAULT);
            try {
                $stmt = $pdo->prepare("INSERT INTO users (email, role, password_hash) VALUES (?, 'editor', ?)");
                $stmt->execute([$email, $hash]);
                flash("Created {$email} with temp password: {$password}");
            } catch (PDOException $e) {
                flash("Account already exists for {$email}.");
            }
        }
    } elseif ($action === "bulk_create") {
        $emails = normalizeEmails((string) ($_POST["emails"] ?? ""));
        if (!$emails) {
            flash("No valid emails provided.");
        } else {
            $created = [];
            foreach ($emails as $email) {
                $password = generatePassword();
                $hash = password_hash($password, PASSWORD_DEFAULT);
                try {
                    $stmt = $pdo->prepare("INSERT INTO users (email, role, password_hash) VALUES (?, 'editor', ?)");
                    $stmt->execute([$email, $hash]);
                    $created[] = "{$email} → {$password}";
                } catch (PDOException $e) {
                    $created[] = "{$email} (already exists)";
                }
            }
            flash("Bulk results:\n" . implode("\n", $created));
        }
    } elseif ($action === "reset_password") {
        $userId = (int) ($_POST["user_id"] ?? 0);
        if ($userId > 0) {
            $password = generatePassword();
            $hash = password_hash($password, PASSWORD_DEFAULT);
            $stmt = $pdo->prepare("UPDATE users SET password_hash = ? WHERE id = ?");
            $stmt->execute([$hash, $userId]);
            flash("New password: {$password}");
        }
    } elseif ($action === "archive" || $action === "restore") {
        $projectId = (int) ($_POST["project_id"] ?? 0);
        if ($projectId > 0) {
            $archived = $action === "archive" ? 1 : 0;
            $stmt = $pdo->prepare("UPDATE projects SET archived = ?, updated_at = ? WHERE id = ?");
            $stmt->execute([$archived, time(), $projectId]);
            writeProjectsIndex($pdo);
        }
    } elseif ($action === "delete_project") {
        $projectId = (int) ($_POST["project_id"] ?? 0);
        if ($projectId > 0) {
            $stmt = $pdo->prepare("SELECT slug FROM projects WHERE id = ?");
            $stmt->execute([$projectId]);
            $project = $stmt->fetch();
            if ($project) {
                $pdo->prepare("DELETE FROM projects WHERE id = ?")->execute([$projectId]);
                deleteDirectory(PROJECTS_ROOT . "/" . $project["slug"]);
                writeProjectsIndex($pdo);
            }
        }
    }
    header("Location: " . $_SERVER["REQUEST_URI"]);
    exit;
}

$flash = pullFlash();
$users = $pdo->query("SELECT id, email, role FROM users ORDER BY email ASC")->fetchAll();
$projects = fetchProjects($pdo);

$flashBlock = "";
if ($flash !== "") {
    $safe = nl2br(htmlspecialchars($flash, ENT_QUOTES));
    $flashBlock = "<div class=\"flash\">{$safe}</div>";
}

$userRows = "";
foreach ($users as $account) {
    $email = htmlspecialchars($account["email"], ENT_QUOTES);
    $role = htmlspecialchars($account["role"], ENT_QUOTES);
    $id = (int) $account["id"];
    $userRows .= "<div class=\"row\">"
        . "<div class=\"meta\"><strong>{$email}</strong><span>{$role}</span></div>"
        . ($role === "manager" ? "<span class=\"status\">Manager</span>" : "")
        . "<form method=\"post\">"
        . "<input type=\"hidden\" name=\"action\" value=\"reset_password\" />"
        . "<input type=\"hidden\" name=\"user_id\" value=\"{$id}\" />"
        . "<button type=\"submit\">Reset password</button>"
        . "</form></div>";
}
if ($userRows === "") {
    $userRows = "<p class=\"empty\">No accounts found.</p>";
}

$projectRows = "";
foreach ($projects as $project) {
    $id = (int) $project["id"];
    $slug = htmlspecialchars($project["slug"] ?? "", ENT_QUOTES);
    $name = htmlspecialchars($project["name"] ?? "Untitled Project", ENT_QUOTES);
    $url = htmlspecialchars($project["url"] ?? "#", ENT_QUOTES);
    $owner = htmlspecialchars((string) ($project["creator"] ?? $project["author"] ?? ""), ENT_QUOTES);
    $archived = !empty($project["archived"]);
    $status = $archived ? "Archived" : "Live";
    $toggleAction = $archived ? "restore" : "archive";
    $toggleLabel = $archived ? "Restore" : "Archive";
    $projectRows .= "<div class=\"row\">"
        . "<div class=\"meta\">"
        . "<strong><a href=\"{$url}\" target=\"_blank\" rel=\"noopener\">{$name}</a></strong>"
        . ($owner ? "<span>By {$owner}</span>" : "")
        . "<span>{$slug}</span>"
        . "</div>"
        . "<div class=\"status\">{$status}</div>"
        . "<form method=\"post\">"
        . "<input type=\"hidden\" name=\"project_id\" value=\"{$id}\" />"
        . "<button name=\"action\" value=\"{$toggleAction}\">{$toggleLabel}</button>"
        . "<button name=\"action\" value=\"delete_project\" class=\"danger\" onclick=\"return confirm('Delete {$name}?');\">Delete</button>"
        . "</form></div>";
}
if ($projectRows === "") {
    $projectRows = "<p class=\"empty\">No projects found.</p>";
}

echo "<!doctype html><html><head><meta charset=\"utf-8\" />"
    . "<meta name=\"viewport\" content=\"width=device-width, initial-scale=1\" />"
    . "<title>Glitchlet Manager</title>"
    . "<style>"
    . "body{margin:0;font-family:Arial,sans-serif;background:#f6f6fb;color:#1b1736;}"
    . ".wrap{max-width:1000px;margin:0 auto;padding:32px 20px;display:grid;gap:28px;}"
    . "h1{margin:0 0 10px;font-size:28px;}"
    . "h2{margin:0 0 10px;font-size:20px;}"
    . ".panel{background:#fff;border-radius:18px;padding:20px;box-shadow:0 14px 28px rgba(0,0,0,0.08);}"
    . ".row{display:grid;grid-template-columns:1fr auto auto;gap:16px;align-items:center;"
    . "background:#f9f9ff;padding:14px;border-radius:14px;margin-top:8px;}"
    . ".meta{display:flex;flex-direction:column;gap:6px;}"
    . ".meta span{font-size:12px;color:#666;}"
    . ".status{font-size:12px;text-transform:uppercase;letter-spacing:0.08em;color:#5b5875;}"
    . "form{display:flex;gap:8px;flex-wrap:wrap;}"
    . "input,textarea{padding:10px;border-radius:10px;border:1px solid #ddd;font-size:14px;}"
    . "textarea{min-height:90px;resize:vertical;width:100%;}"
    . "button{padding:8px 14px;border-radius:999px;border:none;font-weight:600;cursor:pointer;}"
    . ".danger{background:#ffe9e6;color:#a01912;}"
    . ".flash{background:#fff3d8;border:1px solid #f1d28b;color:#7b4d00;padding:12px;"
    . "border-radius:12px;white-space:pre-wrap;font-size:13px;}"
    . ".grid{display:grid;gap:12px;}"
    . ".toolbar{display:flex;gap:10px;flex-wrap:wrap;margin-bottom:8px;}"
    . ".toolbar a{text-decoration:none;background:#3b2d72;color:#fff;padding:6px 10px;border-radius:999px;font-size:12px;}"
    . ".toolbar a.outline{background:#fff;color:#3b2d72;border:1px solid #3b2d72;}"
    . "</style></head><body><div class=\"wrap\">"
    . "<div class=\"toolbar\">"
    . "<a href=\"/publish/projects.php\">My projects</a>"
    . "<a class=\"outline\" href=\"" . APP_URL . "\">Back to App</a>"
    . "<a class=\"outline\" href=\"/projects/index.html\">Published projects</a>"
    . "</div>"
    . "<h1>Manager Console</h1>"
    . $flashBlock
    . "<section class=\"panel\"><h2>Create editor account</h2>"
    . "<form method=\"post\">"
    . "<input type=\"hidden\" name=\"action\" value=\"create_user\" />"
    . "<input name=\"email\" type=\"email\" placeholder=\"email@example.com\" required />"
    . "<button type=\"submit\">Create</button>"
    . "</form></section>"
    . "<section class=\"panel\"><h2>Bulk create accounts</h2>"
    . "<form method=\"post\">"
    . "<input type=\"hidden\" name=\"action\" value=\"bulk_create\" />"
    . "<textarea name=\"emails\" placeholder=\"Paste emails separated by commas or new lines\"></textarea>"
    . "<button type=\"submit\">Create accounts</button>"
    . "</form></section>"
    . "<section class=\"panel\"><h2>Accounts</h2><div class=\"grid\">{$userRows}</div></section>"
    . "<section class=\"panel\"><h2>All projects</h2><div class=\"grid\">{$projectRows}</div></section>"
    . "</div></body></html>";
