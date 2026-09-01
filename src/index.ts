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

        const categories = (results || []).map((row: any) => ({
            name: row.category,
            slug: row.category,
            count: row.count,
        }));

        return c.json({success: true, data: categories});
    } catch (error: any) {
        return c.json({success: false, message: error.message}, 500);
    }
});

// 3. 전체 글 목록 조회 (GET /api/posts?category=개발)
app.get("/api/posts", async (c) => {
    const category = c.req.query("category");
    try {
        let query =
            "SELECT id, slug, thumbnail, title, category, tags, created_at FROM posts";
        let stmt;

        if (category && category !== "all") {
            query += " WHERE category = ? ORDER BY id DESC";
            stmt = c.env.DB.prepare(query).bind(category);
        } else {
            query += " ORDER BY id DESC";
            stmt = c.env.DB.prepare(query);
        }

        const {results} = await stmt.all();

        const posts = (results || []).map((row: any) => ({
            id: String(row.id),
            slug: row.slug || String(row.id),
            thumbnail:
                row.thumbnail ||
                "https://images.unsplash.com/photo-1498050108023-c5249f4df085?w=800&q=80",
            title: row.title,
            createdAt: row.created_at,
            categoryName: row.category,
            categorySlug: row.category,
            tags: row.tags
                ? row.tags.split(",").map((t: string) => t.trim())
                : [],
        }));

        return c.json({success: true, data: posts});
    } catch (error: any) {
        return c.json({success: false, message: error.message}, 500);
    }
});

// 4. 특정 글 상세 조회 (GET /api/posts/:slug)
app.get("/api/posts/:slug", async (c) => {
    const slug = c.req.param("slug");
    try {
        // slug 또는 id로 단일 포스트 조회
        const post: any = await c.env.DB.prepare(
            "SELECT * FROM posts WHERE slug = ? OR id = ?",
        )
            .bind(slug, isNaN(Number(slug)) ? -1 : Number(slug))
            .first();

        if (!post) {
            return c.json(
                {success: false, message: "게시글을 찾을 수 없습니다."},
                404,
            );
        }

        // 이전 글 & 다음 글 조회 (카테고리 연계)
        const prevPostRow: any = await c.env.DB.prepare(
            `SELECT title, slug, id 
             FROM posts 
             WHERE category = ? 
               AND (created_at < ? OR (created_at = ? AND id < ?))
             ORDER BY created_at DESC, id DESC 
             LIMIT 1`,
        )
            .bind(post.category, post.created_at, post.created_at, post.id)
            .first();

        const nextPostRow: any = await c.env.DB.prepare(
            `SELECT title, slug, id 
             FROM posts 
             WHERE category = ? 
               AND (created_at > ? OR (created_at = ? AND id > ?))
             ORDER BY created_at ASC, id ASC 
             LIMIT 1`,
        )
            .bind(post.category, post.created_at, post.created_at, post.id)
            .first();

        // 프론트엔드 Post 타입으로 변환
        const postDetail = {
            id: String(post.id),
            slug: post.slug || String(post.id),
            thumbnail:
                post.thumbnail ||
                "https://images.unsplash.com/photo-1498050108023-c5249f4df085?w=800&q=80",
            title: post.title,
            content: post.content,
            createdAt: post.created_at,
            categoryName: post.category,
            categorySlug: post.category,
            tags: post.tags
                ? post.tags.split(",").map((t: string) => t.trim())
                : [],
            prevPost: prevPostRow
                ? {
                      title: prevPostRow.title,
                      slug: prevPostRow.slug || String(prevPostRow.id),
                  }
                : null,
            nextPost: nextPostRow
                ? {
                      title: nextPostRow.title,
                      slug: nextPostRow.slug || String(nextPostRow.id),
                  }
                : null,
        };

        return c.json({success: true, data: postDetail});
    } catch (error: any) {
        return c.json({success: false, message: error.message}, 500);
    }
});

// 5. 새 글 작성 (POST /api/posts)
app.post("/api/posts", async (c) => {
    try {
        const {title, content, category, tags, slug, thumbnail} =
            await c.req.json();
        if (!title || !content) {
            return c.json(
                {success: false, message: "제목과 내용을 모두 입력해 주세요."},
                400,
            );
        }

        const postCategory = category || "일반";
        const postSlug = slug || title.toLowerCase().replace(/\s+/g, "-");
        const postThumbnail = thumbnail || "";
        const postTags = Array.isArray(tags) ? tags.join(",") : tags || "";

        const info = await c.env.DB.prepare(
            "INSERT INTO posts (title, slug, thumbnail, content, category, tags) VALUES (?, ?, ?, ?, ?, ?)",
        )
            .bind(
                title,
                postSlug,
                postThumbnail,
                content,
                postCategory,
                postTags,
            )
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
        const {title, content, category, tags, slug, thumbnail} =
            await c.req.json();
        const postCategory = category || "일반";
        const postTags = Array.isArray(tags) ? tags.join(",") : tags || "";

        await c.env.DB.prepare(
            "UPDATE posts SET title = ?, slug = ?, thumbnail = ?, content = ?, category = ?, tags = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
        )
            .bind(
                title,
                slug || "",
                thumbnail || "",
                content,
                postCategory,
                postTags,
                id,
            )
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
