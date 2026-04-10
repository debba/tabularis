-- =============================================================
-- Tabularis EXPLAIN Demo Database
-- Compatible with MariaDB / MySQL 8.0+
-- =============================================================
-- This database is designed to produce diverse and interesting
-- EXPLAIN plans for testing Tabularis Visual Explain features.
--
-- Tables have a mix of indexed/unindexed columns, composite
-- indexes, covering indexes, and enough seed data (~15k rows)
-- to trigger varied optimizer strategies.
-- =============================================================

DROP DATABASE IF EXISTS tabularis_explain;
CREATE DATABASE tabularis_explain CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE tabularis_explain;

-- -----------------------------------------------------------
-- Schema
-- -----------------------------------------------------------

CREATE TABLE users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) NOT NULL UNIQUE,
    email VARCHAR(150) NOT NULL,
    full_name VARCHAR(100) NOT NULL,
    country VARCHAR(50) NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    is_premium TINYINT(1) NOT NULL DEFAULT 0,
    score INT NOT NULL DEFAULT 0,
    INDEX idx_country (country),
    INDEX idx_created_at (created_at),
    INDEX idx_premium_score (is_premium, score)
) ENGINE=InnoDB;

CREATE TABLE categories (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    parent_id INT DEFAULT NULL,
    slug VARCHAR(100) NOT NULL UNIQUE,
    FOREIGN KEY (parent_id) REFERENCES categories(id)
) ENGINE=InnoDB;

CREATE TABLE posts (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    category_id INT NOT NULL,
    title VARCHAR(255) NOT NULL,
    body TEXT NOT NULL,
    status ENUM('draft', 'published', 'archived') NOT NULL DEFAULT 'draft',
    view_count INT NOT NULL DEFAULT 0,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    published_at DATETIME DEFAULT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (category_id) REFERENCES categories(id),
    INDEX idx_user_id (user_id),
    INDEX idx_status_created (status, created_at),
    INDEX idx_category (category_id)
) ENGINE=InnoDB;

CREATE TABLE tags (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(50) NOT NULL UNIQUE
) ENGINE=InnoDB;

CREATE TABLE post_tags (
    post_id INT NOT NULL,
    tag_id INT NOT NULL,
    PRIMARY KEY (post_id, tag_id),
    FOREIGN KEY (post_id) REFERENCES posts(id),
    FOREIGN KEY (tag_id) REFERENCES tags(id),
    INDEX idx_tag_id (tag_id)
) ENGINE=InnoDB;

CREATE TABLE comments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    post_id INT NOT NULL,
    user_id INT NOT NULL,
    parent_id INT DEFAULT NULL,
    body TEXT NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    is_flagged TINYINT(1) NOT NULL DEFAULT 0,
    FOREIGN KEY (post_id) REFERENCES posts(id),
    FOREIGN KEY (user_id) REFERENCES users(id),
    INDEX idx_post_id (post_id),
    INDEX idx_user_id (user_id)
) ENGINE=InnoDB;

-- No secondary indexes — forces full table scans
CREATE TABLE audit_log (
    id INT AUTO_INCREMENT PRIMARY KEY,
    entity_type VARCHAR(50) NOT NULL,
    entity_id INT NOT NULL,
    action VARCHAR(20) NOT NULL,
    actor_id INT NOT NULL,
    details JSON,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- Composite + covering index for index-only scan demos
CREATE TABLE user_sessions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    session_token VARCHAR(64) NOT NULL,
    ip_address VARCHAR(45) NOT NULL,
    user_agent VARCHAR(255),
    started_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_active_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    is_active TINYINT(1) NOT NULL DEFAULT 1,
    FOREIGN KEY (user_id) REFERENCES users(id),
    INDEX idx_user_active (user_id, is_active, last_active_at),
    INDEX idx_token (session_token)
) ENGINE=InnoDB;

-- -----------------------------------------------------------
-- Seed: Categories (20 rows — small lookup table)
-- -----------------------------------------------------------

INSERT INTO categories (name, parent_id, slug) VALUES
('Technology',     NULL, 'technology'),
('Science',        NULL, 'science'),
('Business',       NULL, 'business'),
('Lifestyle',      NULL, 'lifestyle'),
('Creative',       NULL, 'creative');

INSERT INTO categories (name, parent_id, slug) VALUES
('Programming',     1, 'programming'),
('DevOps',          1, 'devops'),
('AI & ML',         1, 'ai-ml'),
('Physics',         2, 'physics'),
('Biology',         2, 'biology'),
('Startups',        3, 'startups'),
('Finance',         3, 'finance'),
('Marketing',       3, 'marketing'),
('Health',          4, 'health'),
('Travel',          4, 'travel'),
('Food',            4, 'food'),
('Photography',     5, 'photography'),
('Writing',         5, 'writing'),
('Music',           5, 'music'),
('Design',          5, 'design');

-- -----------------------------------------------------------
-- Seed: Tags (30 rows)
-- -----------------------------------------------------------

INSERT INTO tags (name) VALUES
('javascript'), ('python'), ('rust'), ('go'), ('typescript'),
('react'), ('docker'), ('kubernetes'), ('aws'), ('linux'),
('database'), ('api'), ('security'), ('performance'), ('testing'),
('tutorial'), ('opinion'), ('deep-dive'), ('beginner'), ('advanced'),
('open-source'), ('career'), ('productivity'), ('review'), ('comparison'),
('architecture'), ('frontend'), ('backend'), ('devtools'), ('data');

-- -----------------------------------------------------------
-- Seed: Users (200 rows via cross join)
-- -----------------------------------------------------------

-- Base set of 20 users
INSERT INTO users (username, email, full_name, country, created_at, is_premium, score) VALUES
('alice_dev',     'alice@example.com',     'Alice Johnson',     'USA',       '2023-01-15 10:30:00', 1, 4200),
('bob_code',      'bob@example.com',       'Bob Smith',         'UK',        '2023-02-20 14:00:00', 0, 1800),
('carol_tech',    'carol@example.com',     'Carol Williams',    'Germany',   '2023-03-10 09:15:00', 1, 3600),
('david_ops',     'david@example.com',     'David Brown',       'France',    '2023-04-05 16:45:00', 0, 950),
('elena_ml',      'elena@example.com',     'Elena Davis',       'Spain',     '2023-05-12 11:20:00', 1, 5100),
('frank_sys',     'frank@example.com',     'Frank Miller',      'Italy',     '2023-06-18 08:00:00', 0, 2200),
('grace_sec',     'grace@example.com',     'Grace Wilson',      'Japan',     '2023-07-22 13:30:00', 1, 3900),
('henry_db',      'henry@example.com',     'Henry Moore',       'Brazil',    '2023-08-30 10:00:00', 0, 1500),
('iris_cloud',    'iris@example.com',      'Iris Taylor',       'Canada',    '2023-09-14 15:45:00', 0, 800),
('jack_full',     'jack@example.com',      'Jack Anderson',     'Australia', '2023-10-01 12:00:00', 1, 4800),
('karen_data',    'karen@example.com',     'Karen Thomas',      'Sweden',    '2023-10-20 09:30:00', 0, 2100),
('leo_arch',      'leo@example.com',       'Leo Jackson',       'Netherlands','2023-11-05 14:15:00', 1, 3300),
('maria_ux',      'maria@example.com',     'Maria White',       'India',     '2023-11-28 11:00:00', 0, 1200),
('nathan_api',    'nathan@example.com',    'Nathan Harris',     'South Korea','2023-12-10 16:00:00', 1, 4500),
('olivia_fe',     'olivia@example.com',    'Olivia Martin',     'USA',       '2024-01-08 10:30:00', 0, 600),
('paul_be',       'paul@example.com',      'Paul Garcia',       'UK',        '2024-02-14 13:45:00', 1, 3100),
('quinn_devops',  'quinn@example.com',     'Quinn Martinez',    'Germany',   '2024-03-01 08:30:00', 0, 1700),
('rachel_pm',     'rachel@example.com',    'Rachel Robinson',   'France',    '2024-03-22 15:00:00', 0, 400),
('sam_infra',     'sam@example.com',       'Sam Lee',           'Japan',     '2024-04-10 11:15:00', 1, 2800),
('tina_qa',       'tina@example.com',      'Tina Chen',         'China',     '2024-05-01 09:00:00', 0, 1000);

-- Multiply to ~200 users with varied data
INSERT INTO users (username, email, full_name, country, created_at, is_premium, score)
SELECT
    CONCAT(u.username, '_', n.i),
    CONCAT(n.i, '_', u.email),
    CONCAT(u.full_name, ' ', n.i),
    u.country,
    DATE_ADD(u.created_at, INTERVAL (n.i * 7) DAY),
    IF(RAND() < 0.3, 1, 0),
    FLOOR(RAND() * 5000)
FROM users u
CROSS JOIN (
    SELECT 1 AS i UNION SELECT 2 UNION SELECT 3 UNION SELECT 4
    UNION SELECT 5 UNION SELECT 6 UNION SELECT 7 UNION SELECT 8
    UNION SELECT 9
) n;

-- -----------------------------------------------------------
-- Seed: Posts (~2000 rows)
-- -----------------------------------------------------------

-- Base posts (one per original user)
INSERT INTO posts (user_id, category_id, title, body, status, view_count, created_at, published_at)
SELECT
    u.id,
    1 + FLOOR(RAND() * 20),
    CONCAT('Post by ', u.full_name, ' about ', c.name),
    CONCAT('This is a detailed article about ', c.name, '. It covers many aspects and provides practical examples for readers interested in this topic. The content is based on years of experience and research in the field.'),
    ELT(1 + FLOOR(RAND() * 3), 'draft', 'published', 'archived'),
    FLOOR(RAND() * 10000),
    DATE_ADD(u.created_at, INTERVAL FLOOR(RAND() * 90) DAY),
    IF(RAND() < 0.7, DATE_ADD(u.created_at, INTERVAL FLOOR(RAND() * 90 + 1) DAY), NULL)
FROM users u
CROSS JOIN categories c
WHERE c.parent_id IS NOT NULL
LIMIT 2000;

-- -----------------------------------------------------------
-- Seed: Post Tags (~5000 rows)
-- -----------------------------------------------------------

INSERT IGNORE INTO post_tags (post_id, tag_id)
SELECT
    p.id,
    1 + FLOOR(RAND() * 30)
FROM posts p
CROSS JOIN (SELECT 1 AS i UNION SELECT 2 UNION SELECT 3) n
WHERE RAND() < 0.85;

-- -----------------------------------------------------------
-- Seed: Comments (~6000 rows)
-- -----------------------------------------------------------

INSERT INTO comments (post_id, user_id, body, created_at, is_flagged)
SELECT
    p.id,
    (SELECT id FROM users ORDER BY RAND() LIMIT 1),
    CONCAT('Great article! I especially liked the part about ', LEFT(p.title, 30), '...'),
    DATE_ADD(p.created_at, INTERVAL FLOOR(RAND() * 30) DAY),
    IF(RAND() < 0.05, 1, 0)
FROM posts p
CROSS JOIN (SELECT 1 AS i UNION SELECT 2 UNION SELECT 3) n
WHERE RAND() < 0.95;

-- -----------------------------------------------------------
-- Seed: Audit Log (~5000 rows — no secondary indexes)
-- -----------------------------------------------------------

INSERT INTO audit_log (entity_type, entity_id, action, actor_id, details, created_at)
SELECT
    ELT(1 + FLOOR(RAND() * 4), 'user', 'post', 'comment', 'session'),
    FLOOR(RAND() * 200 + 1),
    ELT(1 + FLOOR(RAND() * 5), 'create', 'update', 'delete', 'view', 'login'),
    FLOOR(RAND() * 200 + 1),
    JSON_OBJECT('ip', CONCAT(FLOOR(RAND()*255),'.',FLOOR(RAND()*255),'.',FLOOR(RAND()*255),'.',FLOOR(RAND()*255)), 'source', ELT(1+FLOOR(RAND()*3), 'web', 'api', 'mobile')),
    DATE_ADD('2023-01-01', INTERVAL FLOOR(RAND() * 600) DAY)
FROM posts p
CROSS JOIN (SELECT 1 AS i UNION SELECT 2 UNION SELECT 3) n
WHERE RAND() < 0.85;

-- -----------------------------------------------------------
-- Seed: User Sessions (~1500 rows)
-- -----------------------------------------------------------

INSERT INTO user_sessions (user_id, session_token, ip_address, user_agent, started_at, last_active_at, is_active)
SELECT
    u.id,
    MD5(CONCAT(u.id, RAND(), NOW())),
    CONCAT(FLOOR(RAND()*255),'.',FLOOR(RAND()*255),'.',FLOOR(RAND()*255),'.',FLOOR(RAND()*255)),
    ELT(1 + FLOOR(RAND() * 4),
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120',
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 14) Safari/17',
        'Mozilla/5.0 (X11; Linux x86_64) Firefox/121',
        'Mozilla/5.0 (iPhone; CPU iOS 17) Mobile/15E148'),
    DATE_ADD(u.created_at, INTERVAL FLOOR(RAND() * 300) DAY),
    DATE_ADD(u.created_at, INTERVAL FLOOR(RAND() * 350 + 300) DAY),
    IF(RAND() < 0.3, 1, 0)
FROM users u
CROSS JOIN (SELECT 1 AS i UNION SELECT 2 UNION SELECT 3 UNION SELECT 4
            UNION SELECT 5 UNION SELECT 6 UNION SELECT 7 UNION SELECT 8) n
WHERE RAND() < 0.95;

-- -----------------------------------------------------------
-- Update statistics for accurate EXPLAIN plans
-- -----------------------------------------------------------

ANALYZE TABLE users;
ANALYZE TABLE categories;
ANALYZE TABLE posts;
ANALYZE TABLE tags;
ANALYZE TABLE post_tags;
ANALYZE TABLE comments;
ANALYZE TABLE audit_log;
ANALYZE TABLE user_sessions;
