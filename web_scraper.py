"""
Web Scraping Tool for OS-Assistant
Gathers app ideas, trends, and technology information for the DayZero builder.
"""

import requests
from bs4 import BeautifulSoup
import json
import time
from typing import Dict, List, Optional, Any
from dataclasses import dataclass
from datetime import datetime
import logging
from urllib.parse import urljoin, urlparse
import re

logger = logging.getLogger(__name__)


@dataclass
class ScrapedIdea:
    """Represents a scraped app idea or trend."""
    title: str
    description: str
    source: str
    url: str
    tags: List[str]
    difficulty: str  # beginner, intermediate, advanced
    tech_stack: List[str]
    scraped_at: datetime
    relevance_score: float = 0.0


class WebScraper:
    """
    Advanced web scraper for gathering app ideas and technology trends.
    Includes rate limiting, error handling, and intelligent filtering.
    """
    
    def __init__(self, rate_limit_delay: float = 1.0):
        """
        Initialize web scraper.
        
        Args:
            rate_limit_delay: Delay between requests in seconds
        """
        self.rate_limit_delay = rate_limit_delay
        self.session = requests.Session()
        
        # Set up headers to mimic a real browser
        self.session.headers.update({
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        })
        
        # Rate limiting
        self.last_request_time = 0
    
    def _rate_limit(self):
        """Implement rate limiting between requests."""
        current_time = time.time()
        time_since_last = current_time - self.last_request_time
        
        if time_since_last < self.rate_limit_delay:
            sleep_time = self.rate_limit_delay - time_since_last
            time.sleep(sleep_time)
        
        self.last_request_time = time.time()
    
    def _safe_request(self, url: str, timeout: int = 10) -> Optional[requests.Response]:
        """
        Make a safe HTTP request with error handling.
        
        Args:
            url: URL to request
            timeout: Request timeout in seconds
            
        Returns:
            Response object or None if failed
        """
        try:
            self._rate_limit()
            response = self.session.get(url, timeout=timeout)
            response.raise_for_status()
            return response
        except requests.RequestException as e:
            logger.error(f"Failed to fetch {url}: {e}")
            return None
    
    def scrape_github_trending(self, language: str = "python", limit: int = 20) -> List[ScrapedIdea]:
        """
        Scrape GitHub trending repositories for app ideas.
        
        Args:
            language: Programming language to filter by
            limit: Maximum number of results to return
            
        Returns:
            List of scraped app ideas
        """
        url = f"https://github.com/trending/{language}"
        response = self._safe_request(url)
        
        if not response:
            return []
        
        soup = BeautifulSoup(response.content, 'html.parser')
        ideas = []
        
        # Find repository cards
        repo_cards = soup.find_all('article', class_='Box-row')
        
        for card in repo_cards[:limit]:
            try:
                # Extract repository info
                name_elem = card.find('h1', class_='h3').find('a')
                repo_name = name_elem.get_text(strip=True).replace('/', ' - ')
                
                description_elem = card.find('p', class_='col-9')
                description = description_elem.get_text(strip=True) if description_elem else "No description available"
                
                # Extract tags
                tag_elems = card.find_all('a', class_='topic-tag')
                tags = [tag.get_text(strip=True) for tag in tag_elems]
                
                # Build URL
                repo_url = urljoin(url, name_elem['href'])
                
                # Determine difficulty and tech stack
                difficulty = self._estimate_difficulty(description, tags)
                tech_stack = self._extract_tech_stack(description, tags)
                
                idea = ScrapedIdea(
                    title=repo_name,
                    description=description,
                    source="GitHub Trending",
                    url=repo_url,
                    tags=tags,
                    difficulty=difficulty,
                    tech_stack=tech_stack,
                    scraped_at=datetime.now()
                )
                
                ideas.append(idea)
                
            except Exception as e:
                logger.error(f"Error parsing GitHub repo card: {e}")
                continue
        
        return ideas
    
    def scrape_product_hunt(self, limit: int = 15) -> List[ScrapedIdea]:
        """
        Scrape Product Hunt for trending products and app ideas.
        
        Args:
            limit: Maximum number of results to return
            
        Returns:
            List of scraped app ideas
        """
        # Note: Product Hunt may require API access for full functionality
        # This is a basic implementation that may need API keys for production
        url = "https://www.producthunt.com/api/v2/api-docs"
        
        # For now, return mock data structure
        # In production, this would use the Product Hunt API
        logger.warning("Product Hunt scraping requires API access. Returning mock structure.")
        
        return []
    
    def scrape_tech_blogs(self, topics: List[str] = None, limit: int = 10) -> List[ScrapedIdea]:
        """
        Scrape technology blogs for trending topics and tutorials.
        
        Args:
            topics: List of topics to search for
            limit: Maximum number of results to return
            
        Returns:
            List of scraped app ideas
        """
        if topics is None:
            topics = ["web development", "AI", "machine learning", "mobile apps", "productivity"]
        
        ideas = []
        
        # Tech blog URLs to scrape
        tech_blogs = [
            "https://blog.stackoverflow.com/",
            "https://dev.to/",
            "https://css-tricks.com/",
            "https://www.smashingmagazine.com/",
        ]
        
        for blog_url in tech_blogs:
            response = self._safe_request(blog_url)
            if not response:
                continue
            
            soup = BeautifulSoup(response.content, 'html.parser')
            
            # Find article links (this will vary by site structure)
            article_links = []
            
            # Common selectors for article links
            selectors = [
                'article a',
                '.post a',
                '.article a',
                '.entry a',
                'h2 a',
                'h3 a'
            ]
            
            for selector in selectors:
                links = soup.select(selector)
                article_links.extend(links)
                if len(article_links) >= limit:
                    break
            
            for link in article_links[:limit]:
                try:
                    title = link.get_text(strip=True)
                    url = urljoin(blog_url, link.get('href', ''))
                    
                    if not title or not url:
                        continue
                    
                    # Filter by topics
                    title_lower = title.lower()
                    if topics and not any(topic.lower() in title_lower for topic in topics):
                        continue
                    
                    idea = ScrapedIdea(
                        title=title,
                        description=f"Article from {urlparse(blog_url).netloc}",
                        source="Tech Blog",
                        url=url,
                        tags=topics,
                        difficulty="intermediate",
                        tech_stack=[],
                        scraped_at=datetime.now()
                    )
                    
                    ideas.append(idea)
                    
                    if len(ideas) >= limit:
                        break
                
                except Exception as e:
                    logger.error(f"Error parsing blog article: {e}")
                    continue
            
            if len(ideas) >= limit:
                break
        
        return ideas
    
    def scrape_stackoverflow_trends(self, tags: List[str] = None, limit: int = 10) -> List[ScrapedIdea]:
        """
        Scrape Stack Overflow for trending questions and topics.
        
        Args:
            tags: List of tags to search for
            limit: Maximum number of results to return
            
        Returns:
            List of scraped app ideas
        """
        if tags is None:
            tags = ["python", "javascript", "react", "node.js", "ai", "machine-learning"]
        
        ideas = []
        
        for tag in tags:
            url = f"https://stackoverflow.com/questions/tagged/{tag}?sort=votes&pagesize=50"
            response = self._safe_request(url)
            
            if not response:
                continue
            
            soup = BeautifulSoup(response.content, 'html.parser')
            question_links = soup.find_all('a', class_='question-hyperlink')
            
            for link in question_links[:limit]:
                try:
                    title = link.get_text(strip=True)
                    url = urljoin("https://stackoverflow.com", link.get('href', ''))
                    
                    if not title:
                        continue
                    
                    # Extract keywords from title for tech stack
                    tech_keywords = self._extract_tech_keywords(title)
                    
                    idea = ScrapedIdea(
                        title=f"Stack Overflow: {title}",
                        description=f"Popular question about {tag}",
                        source="Stack Overflow",
                        url=url,
                        tags=[tag] + tech_keywords,
                        difficulty="intermediate",
                        tech_stack=tech_keywords,
                        scraped_at=datetime.now()
                    )
                    
                    ideas.append(idea)
                    
                    if len(ideas) >= limit:
                        break
                
                except Exception as e:
                    logger.error(f"Error parsing Stack Overflow question: {e}")
                    continue
            
            if len(ideas) >= limit:
                break
        
        return ideas
    
    def _estimate_difficulty(self, description: str, tags: List[str]) -> str:
        """Estimate the difficulty level of a project."""
        description_lower = description.lower()
        tags_lower = [tag.lower() for tag in tags]
        
        # Keywords indicating difficulty
        beginner_keywords = ['tutorial', 'beginner', 'simple', 'basic', 'hello world']
        advanced_keywords = ['ml', 'ai', 'neural', 'distributed', 'microservices', 'kubernetes', 'docker']
        
        if any(keyword in description_lower for keyword in beginner_keywords):
            return "beginner"
        elif any(keyword in description_lower for keyword in advanced_keywords):
            return "advanced"
        elif any(keyword in tags_lower for keyword in advanced_keywords):
            return "advanced"
        else:
            return "intermediate"
    
    def _extract_tech_stack(self, description: str, tags: List[str]) -> List[str]:
        """Extract technology stack from description and tags."""
        tech_keywords = set()
        
        # Common technologies
        tech_patterns = [
            r'\b(react|vue|angular|svelte)\b',
            r'\b(node\.js|python|javascript|typescript|java|c#|go|rust)\b',
            r'\b(postgresql|mysql|mongodb|redis|sqlite)\b',
            r'\b(docker|kubernetes|aws|azure|gcp)\b',
            r'\b(api|rest|graphql|websocket)\b'
        ]
        
        text = f"{description} {' '.join(tags)}".lower()
        
        for pattern in tech_patterns:
            matches = re.findall(pattern, text)
            tech_keywords.update(matches)
        
        return list(tech_keywords)
    
    def _extract_tech_keywords(self, title: str) -> List[str]:
        """Extract technology keywords from a title."""
        tech_keywords = []
        title_lower = title.lower()
        
        tech_terms = [
            'react', 'vue', 'angular', 'svelte', 'node.js', 'python', 'javascript',
            'typescript', 'java', 'c#', 'go', 'rust', 'postgresql', 'mysql',
            'mongodb', 'redis', 'docker', 'kubernetes', 'aws', 'azure', 'gcp'
        ]
        
        for term in tech_terms:
            if term in title_lower:
                tech_keywords.append(term)
        
        return tech_keywords
    
    def generate_app_ideas_report(self, output_file: Optional[str] = None) -> Dict[str, Any]:
        """
        Generate a comprehensive report of app ideas from multiple sources.
        
        Args:
            output_file: Optional file to save the report to
            
        Returns:
            Dictionary containing the report data
        """
        logger.info("Generating comprehensive app ideas report...")
        
        # Scrape from multiple sources
        github_ideas = self.scrape_github_trending(limit=15)
        blog_ideas = self.scrape_tech_blogs(limit=10)
        stackoverflow_ideas = self.scrape_stackoverflow_trends(limit=10)
        
        # Combine and deduplicate
        all_ideas = github_ideas + blog_ideas + stackoverflow_ideas
        
        # Remove duplicates based on URL
        seen_urls = set()
        unique_ideas = []
        for idea in all_ideas:
            if idea.url not in seen_urls:
                seen_urls.add(idea.url)
                unique_ideas.append(idea)
        
        # Categorize by difficulty
        categorized_ideas = {
            'beginner': [],
            'intermediate': [],
            'advanced': []
        }
        
        for idea in unique_ideas:
            categorized_ideas[idea.difficulty].append({
                'title': idea.title,
                'description': idea.description,
                'source': idea.source,
                'url': idea.url,
                'tags': idea.tags,
                'tech_stack': idea.tech_stack,
                'scraped_at': idea.scraped_at.isoformat()
            })
        
        # Generate statistics
        stats = {
            'total_ideas': len(unique_ideas),
            'by_difficulty': {k: len(v) for k, v in categorized_ideas.items()},
            'by_source': {
                'GitHub Trending': len([i for i in unique_ideas if i.source == 'GitHub Trending']),
                'Tech Blogs': len([i for i in unique_ideas if i.source == 'Tech Blog']),
                'Stack Overflow': len([i for i in unique_ideas if i.source == 'Stack Overflow'])
            },
            'most_common_tags': self._get_most_common_tags(unique_ideas),
            'most_common_tech': self._get_most_common_tech(unique_ideas)
        }
        
        report = {
            'generated_at': datetime.now().isoformat(),
            'statistics': stats,
            'ideas_by_difficulty': categorized_ideas,
            'all_ideas': [
                {
                    'title': idea.title,
                    'description': idea.description,
                    'source': idea.source,
                    'url': idea.url,
                    'tags': idea.tags,
                    'difficulty': idea.difficulty,
                    'tech_stack': idea.tech_stack,
                    'scraped_at': idea.scraped_at.isoformat()
                }
                for idea in unique_ideas
            ]
        }
        
        # Save to file if requested
        if output_file:
            with open(output_file, 'w', encoding='utf-8') as f:
                json.dump(report, f, indent=2, ensure_ascii=False)
            logger.info(f"Report saved to {output_file}")
        
        logger.info(f"Generated report with {len(unique_ideas)} unique app ideas")
        return report
    
    def _get_most_common_tags(self, ideas: List[ScrapedIdea]) -> List[Dict[str, int]]:
        """Get the most common tags across all ideas."""
        tag_counts = {}
        for idea in ideas:
            for tag in idea.tags:
                tag_lower = tag.lower()
                tag_counts[tag_lower] = tag_counts.get(tag_lower, 0) + 1
        
        # Sort by count
        sorted_tags = sorted(tag_counts.items(), key=lambda x: x[1], reverse=True)
        return [{"tag": tag, "count": count} for tag, count in sorted_tags[:10]]
    
    def _get_most_common_tech(self, ideas: List[ScrapedIdea]) -> List[Dict[str, int]]:
        """Get the most common technologies across all ideas."""
        tech_counts = {}
        for idea in ideas:
            for tech in idea.tech_stack:
                tech_lower = tech.lower()
                tech_counts[tech_lower] = tech_counts.get(tech_lower, 0) + 1
        
        # Sort by count
        sorted_tech = sorted(tech_counts.items(), key=lambda x: x[1], reverse=True)
        return [{"technology": tech, "count": count} for tech, count in sorted_tech[:10]]


# Global web scraper instance
web_scraper = WebScraper(rate_limit_delay=2.0)  # 2 second delay between requests


def get_web_scraper() -> WebScraper:
    """Get the global web scraper instance."""
    return web_scraper


def scrape_app_ideas() -> Dict[str, Any]:
    """Convenience function to scrape app ideas from multiple sources."""
    return web_scraper.generate_app_ideas_report()


if __name__ == "__main__":
    # Example usage
    scraper = WebScraper()
    
    print("Scraping GitHub trending repositories...")
    github_ideas = scraper.scrape_github_trending(limit=5)
    for idea in github_ideas:
        print(f"- {idea.title} ({idea.difficulty})")
    
    print("\nGenerating comprehensive report...")
    report = scraper.generate_app_ideas_report("app_ideas_report.json")
    print(f"Generated report with {report['statistics']['total_ideas']} ideas")