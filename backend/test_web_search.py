# -*- coding: utf-8 -*-
"""独立测试后端联网搜索（Tavily + research 流水线），输出便于截图记录。
运行：uv run python test_web_search.py
"""
import os
import sys
import time

# 确保能 import backend 包
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

# 加载 .env（拿到真实 TAVILY_API_KEY）
try:
    from dotenv import load_dotenv
    load_dotenv()
except Exception:
    pass


def line(c="="):
    print(c * 60)


def main():
    topic = sys.argv[1] if len(sys.argv) > 1 else "2026 年最值得关注的 AI Agent 框架"

    line()
    print("  is2ppt 后端联网搜索 自测")
    print(f"  测试主题：{topic}")
    print(f"  时间：{time.strftime('%Y-%m-%d %H:%M:%S')}")
    line()

    key = os.getenv("TAVILY_API_KEY", "")
    print(f"[环境] TAVILY_API_KEY 是否配置：{'是' if key else '否'}  "
          f"(前缀 {key[:8]+ '...' if key else '空'})")
    print(f"[环境] SEARCH_PROVIDER：{os.getenv('SEARCH_PROVIDER', 'tavily')}")
    print()

    # ---------- ① Tavily 原始搜索 ----------
    line("-")
    print("① 第一层：Tavily 单次原始搜索")
    line("-")
    from services.search.tavily_provider import TavilyProvider
    provider = TavilyProvider(api_key=key)  # 显式传 key，避免脱离 Flask 上下文
    print(f"provider.is_configured() = {provider.is_configured()}")

    t0 = time.time()
    resp = provider.search(topic, max_results=5)
    dt = time.time() - t0
    print(f"耗时：{dt:.2f}s   返回结果数：{len(resp.results)}")
    if resp.answer:
        print(f"\nTavily 摘要(answer)：{resp.answer[:200]}...")
    print("\n前几条结果：")
    for i, r in enumerate(resp.results, 1):
        print(f"  {i}. [{r.score:.3f}] {r.title}")
        print(f"     {r.url}")
    assert len(resp.results) > 0, "❌ Tavily 未返回任何结果"
    print("\n✅ 第一层通过：Tavily 联网搜索正常返回结果")
    print()

    # ---------- ② research 流水线（无 LLM 降级路径） ----------
    line("-")
    print("② 第二层：research_service 完整流水线（无 LLM，走降级汇总）")
    line("-")
    from services import research_service
    t0 = time.time()
    result = research_service.run_research(
        topic, ai_service=None, provider=provider, max_queries=3
    )
    dt = time.time() - t0
    print(f"耗时：{dt:.2f}s")
    print(f"生成查询 queries：{result['queries']}")
    print(f"去重后来源数 sources：{len(result['sources'])}")
    print("\n--- research_context（注入大纲的简报）---")
    print(result["research_context"])
    print("\n--- sources（可溯源链接）---")
    for i, s in enumerate(result["sources"], 1):
        print(f"  {i}. {s['title']}  ->  {s['url']}")

    assert result["research_context"], "❌ research_context 为空"
    assert len(result["sources"]) > 0, "❌ 未收集到任何来源"
    print("\n✅ 第二层通过：research 流水线产出简报 + 来源")

    print()
    line()
    print("  🎉 全部通过：后端联网搜索功能正常")
    line()


if __name__ == "__main__":
    main()
