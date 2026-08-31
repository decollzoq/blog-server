import {Hono} from "hono";
import {cors} from "hono/cors";

type Bindings = {
    DB: D1Database;
};

const app = new Hono<{Bindings: Bindings}>();

// 1. CORS 전체 허용
app.use("*", cors());

// 2. 카테고리 목록 및 글 개수 조회 (GET /api/categories)
app.get("/api/categories", async (c) => {
    try {
        const {results} = await c.env.DB.prepare(
            "SELECT category, COUNT(*) as count FROM posts GROUP BY category ORDER BY count DESC",
        ).all();
        return c.json({success: true, data: results});
    } catch (error: any) {
        return c.json({success: false, message: error.message}, 500);
    }
});

// 3. 전체 글 목록 조회 (카테고리 쿼리 파라미터 지원: GET /api/posts?category=개발)
app.get("/api/posts", async (c) => {
    const category = c.req.query("category");
    try {
        let query = "SELECT id, title, category, tags, created_at FROM posts";
        let stmt;

        if (category) {
            query += " WHERE category = ? ORDER BY id DESC";
            stmt = c.env.DB.prepare(query).bind(category);
        } else {
            query += " ORDER BY id DESC";
            stmt = c.env.DB.prepare(query);
        }

        const {results} = await stmt.all();
        return c.json({success: true, data: results});
    } catch (error: any) {
        return c.json({success: false, message: error.message}, 500);
    }
});

// 4. 특정 글 상세 조회 (GET /api/posts/:id)
app.get("/api/posts/:id", async (c) => {
    const id = c.req.param("id");
    try {
        const post = await c.env.DB.prepare("SELECT * FROM posts WHERE id = ?")
            .bind(id)
            .first();

        if (!post) {
            return c.json(
                {success: false, message: "게시글을 찾을 수 없습니다."},
                404,
            );
        }
        return c.json({success: true, data: post});
    } catch (error: any) {
        return c.json({success: false, message: error.message}, 500);
    }
});

// 5. 새 글 작성 (POST /api/posts)
app.post("/api/posts", async (c) => {
    try {
        const {title, content, category, tags} = await c.req.json();
        if (!title || !content) {
            return c.json(
                {success: false, message: "제목과 내용을 모두 입력해 주세요."},
                400,
            );
        }

        const postCategory = category || "일반";
        const info = await c.env.DB.prepare(
            "INSERT INTO posts (title, content, category, tags) VALUES (?, ?, ?, ?)",
        )
            .bind(title, content, postCategory, tags || "")
            .run();

        return c.json({success: true, id: info.meta.last_row_id}, 201);
    } catch (error: any) {
        return c.json({success: false, message: error.message}, 500);
    }
});

// 6. 글 수정 (PUT /api/posts/:id)
app.put("/api/posts/:id", async (c) => {
    const id = c.req.param("id");
    try {
        const {title, content, category, tags} = await c.req.json();
        const postCategory = category || "일반";

        await c.env.DB.prepare(
            "UPDATE posts SET title = ?, content = ?, category = ?, tags = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
        )
            .bind(title, content, postCategory, tags || "", id)
            .run();

        return c.json({success: true, message: "수정되었습니다."});
    } catch (error: any) {
        return c.json({success: false, message: error.message}, 500);
    }
});

// 7. 글 삭제 (DELETE /api/posts/:id)
app.delete("/api/posts/:id", async (c) => {
    const id = c.req.param("id");
    try {
        await c.env.DB.prepare("DELETE FROM posts WHERE id = ?").bind(id).run();
        return c.json({success: true, message: "삭제되었습니다."});
    } catch (error: any) {
        return c.json({success: false, message: error.message}, 500);
    }
});

export default app;
