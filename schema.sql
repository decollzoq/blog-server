-- server/schema.sql
DROP TABLE IF EXISTS posts;

CREATE TABLE posts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT '일반',
  tags TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 테스트용 초기 데이터
INSERT INTO posts (title, content, category, tags) 
VALUES 
  ('첫 번째 개발 일지', 'Cloudflare Workers + Hono + D1으로 작성된 글입니다.', '개발', 'hono,cloudflare,d1'),
  ('프론트엔드 최적화 팁', 'Web Vitals와 번들 다이어트 관련 글입니다.', '프론트엔드', 'react,performance'),
  ('일상 기록', '블로그를 새로 단장했습니다.', '일상', 'daily');