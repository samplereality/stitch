<?php
declare(strict_types=1);

require_once __DIR__ . "/auth.php";
require_once __DIR__ . "/projects_helpers.php";
require_once __DIR__ . "/mailer.php";
require_once __DIR__ . "/password_reset.php";

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

function buildResetLink(string $token): string {
    return rtrim(APP_URL, "/") . "/publish/reset.php?token=" . $token;
}

function sendResetEmail(string $email, string $link, bool $isNew): bool {
    $subject = $isNew ? "Set your Glitchlet password" : "Reset your Glitchlet password";
    $body = "Hello,\n\n";
    $body .= $isNew
        ? "Your Glitchlet account has been created. Set your password using this link:\n"
        : "Use this link to reset your Glitchlet password:\n";
    $body .= $link . "\n\n";
    $body .= "If you did not request this, you can ignore this email.\n";
    $body .= "\nThanks,\nGlitchlet";
    return smtpSendMail($email, $subject, $body);
}

function sendTestEmail(string $email): bool {
    $subject = "Glitchlet SMTP test";
    $body = "This is a test email from Glitchlet.\n\nIf you received this, SMTP is working.";
    return smtpSendMail($email, $subject, $body);
}

if ($_SERVER["REQUEST_METHOD"] === "POST") {
    $action = $_POST["action"] ?? "";
    if ($action === "create_user") {
        $email = strtolower(trim((string) ($_POST["email"] ?? "")));
        if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
            flash("Invalid email address.");
        } else {
            $hash = password_hash(bin2hex(random_bytes(16)), PASSWORD_DEFAULT);
            try {
                $stmt = $pdo->prepare("INSERT INTO users (email, role, password_hash) VALUES (?, 'editor', ?)");
                $stmt->execute([$email, $hash]);
                $userId = (int) $pdo->lastInsertId();
                $token = createPasswordResetToken($pdo, $userId);
                $link = buildResetLink($token);
                if (sendResetEmail($email, $link, true)) {
                    flash("Created {$email} and sent a password setup email.");
                } else {
                    $error = smtpLastError();
                    $detail = $error ? " ({$error})" : "";
                    flash("Created {$email}, but email failed{$detail}. Send this link: {$link}");
                }
            } catch (PDOException $e) {
                if ($e->getCode() === "23000") {
                    flash("Account already exists for {$email}.");
                } else {
                    flash("Failed to create {$email}: " . $e->getMessage());
                }
            }
        }
    } elseif ($action === "bulk_create") {
        $emails = normalizeEmails((string) ($_POST["emails"] ?? ""));
        if (!$emails) {
            flash("No valid emails provided.");
        } else {
            $created = [];
            foreach ($emails as $email) {
                $hash = password_hash(bin2hex(random_bytes(16)), PASSWORD_DEFAULT);
                try {
                    $stmt = $pdo->prepare("INSERT INTO users (email, role, password_hash) VALUES (?, 'editor', ?)");
                    $stmt->execute([$email, $hash]);
                    $userId = (int) $pdo->lastInsertId();
                    $token = createPasswordResetToken($pdo, $userId);
                    $link = buildResetLink($token);
                    if (sendResetEmail($email, $link, true)) {
                        $created[] = "{$email} (email sent)";
                    } else {
                        $error = smtpLastError();
                        $detail = $error ? " - {$error}" : "";
                        $created[] = "{$email} (email failed{$detail}, link: {$link})";
                    }
                } catch (PDOException $e) {
                    if ($e->getCode() === "23000") {
                        $created[] = "{$email} (already exists)";
                    } else {
                        $created[] = "{$email} (create failed: " . $e->getMessage() . ")";
                    }
                }
            }
            flash("Bulk results:\n" . implode("\n", $created));
        }
    } elseif ($action === "reset_password") {
        $userId = (int) ($_POST["user_id"] ?? 0);
        if ($userId > 0) {
            $stmt = $pdo->prepare("SELECT email FROM users WHERE id = ? LIMIT 1");
            $stmt->execute([$userId]);
            $userRow = $stmt->fetch();
            if ($userRow) {
                $token = createPasswordResetToken($pdo, $userId);
                $link = buildResetLink($token);
                $email = (string) $userRow["email"];
                if (sendResetEmail($email, $link, false)) {
                    flash("Sent password reset email to {$email}.");
                } else {
                    $error = smtpLastError();
                    $detail = $error ? " ({$error})" : "";
                    flash("Email failed{$detail}. Send this link to {$email}: {$link}");
                }
            }
        }
    } elseif ($action === "test_email") {
        $email = strtolower(trim((string) ($_POST["email"] ?? "")));
        if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
            flash("Enter a valid email for the test.");
        } else {
            if (sendTestEmail($email)) {
                flash("Test email sent to {$email}.");
            } else {
                $error = smtpLastError();
                $detail = $error ? " ({$error})" : "";
                flash("Test email failed{$detail}. Check SMTP settings.");
            }
        }
    } elseif ($action === "delete_user") {
        $userId = (int) ($_POST["user_id"] ?? 0);
        $deleteProjects = !empty($_POST["delete_projects"]);
        if ($userId > 0) {
            if ($userId === (int) $user["id"]) {
                flash("You cannot delete the active manager account.");
            } else {
                if ($deleteProjects) {
                    $stmt = $pdo->prepare("SELECT slug FROM projects WHERE owner_user_id = ?");
                    $stmt->execute([$userId]);
                    $owned = $stmt->fetchAll();
                    foreach ($owned as $project) {
                        if (!empty($project["slug"])) {
                            deleteDirectory(PROJECTS_ROOT . "/" . $project["slug"]);
                        }
                    }
                    $stmt = $pdo->prepare("DELETE FROM projects WHERE owner_user_id = ?");
                    $stmt->execute([$userId]);
                } else {
                    $stmt = $pdo->prepare("UPDATE projects SET owner_user_id = ? WHERE owner_user_id = ?");
                    $stmt->execute([(int) $user["id"], $userId]);
                }
                $stmt = $pdo->prepare("DELETE FROM users WHERE id = ?");
                $stmt->execute([$userId]);
                writeProjectsIndex($pdo);
                flash($deleteProjects
                    ? "User deleted and their projects removed."
                    : "User deleted. Their projects were reassigned to you.");
            }
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
startSession();
$sortOptions = [
    "name" => "name ASC",
    "date" => "published_at DESC",
    "creator" => "creator ASC",
];
$sort = (string) ($_GET["sort"] ?? ($_SESSION["manager_sort"] ?? "date"));
if (!array_key_exists($sort, $sortOptions)) {
    $sort = "date";
}
$_SESSION["manager_sort"] = $sort;
$orderBy = $sortOptions[$sort];
$projects = $pdo->query("SELECT * FROM projects ORDER BY {$orderBy}")->fetchAll();

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
        . "</form>"
        . ($role === "manager" ? "" : "<form method=\"post\" onsubmit=\"return confirm('Delete {$email}?');\">"
            . "<input type=\"hidden\" name=\"action\" value=\"delete_user\" />"
            . "<input type=\"hidden\" name=\"user_id\" value=\"{$id}\" />"
            . "<label class=\"inline-checkbox\"><input type=\"checkbox\" name=\"delete_projects\" />Delete projects</label>"
            . "<button type=\"submit\" class=\"danger\">Delete user</button>"
            . "</form>")
        . "</div>";
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
    $publishedLabel = "";
    if (!empty($project["published_at"])) {
        $publishedLabel = date("M j, Y", (int) $project["published_at"]);
    }
    $archived = !empty($project["archived"]);
    $status = $archived ? "Archived" : "Live";
    $toggleAction = $archived ? "restore" : "archive";
    $toggleLabel = $archived ? "Restore" : "Archive";
    $projectRows .= "<div class=\"row\">"
        . "<div class=\"meta\">"
        . "<strong><a href=\"{$url}\" target=\"_blank\" rel=\"noopener\">{$name}</a></strong>"
        . ($owner ? "<span>By {$owner}</span>" : "")
        . ($publishedLabel ? "<span>Published {$publishedLabel}</span>" : "")
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
    . ".panel>form{flex-direction:column;align-items:flex-start;}"
    . ".panel>form button{align-self:flex-start;}"
    . "input,textarea{padding:10px;border-radius:10px;border:1px solid #ddd;font-size:14px;width:100%;max-width:520px;}"
    . ".inline-checkbox{display:flex;align-items:center;gap:6px;font-size:12px;color:#555;}"
    . ".inline-checkbox input{width:auto;max-width:none;padding:0;border:none;}"
    . "textarea{min-height:90px;resize:vertical;width:100%;}"
    . "button{padding:8px 14px;border-radius:999px;border:none;font-weight:600;cursor:pointer;}"
    . ".danger{background:#ffe9e6;color:#a01912;}"
    . ".flash{background:#fff3d8;border:1px solid #f1d28b;color:#7b4d00;padding:12px;"
    . "border-radius:12px;white-space:pre-wrap;font-size:13px;}"
    . ".grid{display:grid;gap:12px;}"
    . ".toolbar{display:flex;gap:10px;flex-wrap:wrap;margin-bottom:8px;align-items:center;}"
    . ".toolbar a,.toolbar button{text-decoration:none;background:#3b2d72;color:#fff;padding:6px 10px;border-radius:999px;"
    . "font-size:12px;border:none;cursor:pointer;transition:transform 0.2s ease,box-shadow 0.2s ease,filter 0.2s ease;}"
    . ".toolbar a:hover,.toolbar button:hover{transform:translateY(-1px);box-shadow:0 6px 14px rgba(31,29,26,0.12);filter:brightness(1.05);}"
    . ".toolbar a.outline{background:#fff;color:#3b2d72;border:1px solid #3b2d72;}"
    . ".sort-row{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px;}"
    . ".sort-row a{text-decoration:none;background:#fff;color:#3b2d72;border:1px solid #3b2d72;"
    . "padding:6px 10px;border-radius:999px;font-size:12px;}"
    . ".sort-row a.is-active{background:#3b2d72;color:#fff;}"
    . "</style></head><body><div class=\"wrap\">"
    . "<div class=\"toolbar\">"
    . "<a class=\"outline\" href=\"" . APP_URL . "\">Glitchlet</a>"
    . "<a class=\"outline\" href=\"/projects/index.html\">Published projects</a>"
    . "<form method=\"post\" action=\"/publish/logout.php\">"
    . "<input type=\"hidden\" name=\"redirect\" value=\"" . APP_URL . "\" />"
    . "<button type=\"submit\">Log out</button>"
    . "</form>"
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
    . "<section class=\"panel\"><h2>Test email delivery</h2>"
    . "<form method=\"post\" id=\"testEmailForm\">"
    . "<input type=\"hidden\" name=\"action\" value=\"test_email\" />"
    . "<input name=\"email\" type=\"email\" placeholder=\"email@example.com\" required />"
    . "<button type=\"submit\" id=\"testEmailBtn\">Send test email</button>"
    . "</form></section>"
    . "<section class=\"panel\"><h2>Accounts</h2><div class=\"grid\">{$userRows}</div></section>"
    . "<section class=\"panel\"><h2>All projects</h2>"
    . "<div class=\"sort-row\">"
    . "<a class=\"" . ($sort === "name" ? "is-active" : "") . "\" href=\"?sort=name\">Sort by name</a>"
    . "<a class=\"" . ($sort === "date" ? "is-active" : "") . "\" href=\"?sort=date\">Sort by date</a>"
    . "<a class=\"" . ($sort === "creator" ? "is-active" : "") . "\" href=\"?sort=creator\">Sort by creator</a>"
    . "</div>"
    . "<div class=\"grid\">{$projectRows}</div></section>"
    . "</div>"
    . "<script>"
    . "const testForm=document.getElementById('testEmailForm');"
    . "const testBtn=document.getElementById('testEmailBtn');"
    . "if(testForm&&testBtn){testForm.addEventListener('submit',()=>{"
    . "testBtn.disabled=true;testBtn.textContent='Sending...';});}"
    . "</script></body></html>";
