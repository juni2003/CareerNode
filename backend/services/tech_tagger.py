"""
Tech Stack Tagger Service
Scans job descriptions and automatically extracts technology tags.
"""

import re
from typing import List

# Comprehensive tech keyword dictionary
TECH_KEYWORDS = {
    # Languages
    "Python", "JavaScript", "TypeScript", "Java", "C++", "C#", "Go", "Golang",
    "Rust", "Kotlin", "Swift", "Ruby", "PHP", "Scala", "R", "MATLAB", "Dart",
    "Bash", "Shell", "PowerShell",

    # Frontend
    "React", "React.js", "Next.js", "Vue", "Vue.js", "Angular", "Svelte",
    "HTML", "CSS", "SASS", "SCSS", "Webpack", "Vite", "Redux", "GraphQL",
    "REST", "WebSocket", "jQuery", "Bootstrap", "Tailwind",

    # Backend
    "FastAPI", "Django", "Flask", "Node.js", "Express", "Spring Boot",
    "Laravel", "Rails", "ASP.NET", "gRPC", "Nginx", "Apache",

    # Databases
    "MongoDB", "PostgreSQL", "MySQL", "SQLite", "Redis", "Elasticsearch",
    "Cassandra", "DynamoDB", "Firebase", "Supabase", "SQLAlchemy",

    # Cloud & DevOps
    "AWS", "GCP", "Azure", "Docker", "Kubernetes", "Terraform", "Ansible",
    "CI/CD", "GitHub Actions", "Jenkins", "CircleCI", "Helm", "Linux",

    # AI / ML
    "TensorFlow", "PyTorch", "Scikit-learn", "Keras", "Hugging Face",
    "LangChain", "OpenAI", "Gemini", "LLM", "NLP", "Computer Vision",
    "MLflow", "CUDA", "Pandas", "NumPy", "Matplotlib", "Seaborn",
    "XGBoost", "LightGBM", "BERT", "GPT", "Transformers",

    # Tools
    "Git", "GitHub", "GitLab", "Jira", "Figma", "Postman", "VS Code",
    "Jupyter", "Airflow", "Kafka", "RabbitMQ", "Celery",

    # Mobile
    "Flutter", "React Native", "Android", "iOS", "Swift", "Kotlin",

    # Data Engineering
    "Spark", "Hadoop", "dbt", "Snowflake", "BigQuery", "Databricks",
    "ETL", "Data Pipeline", "Tableau", "Power BI",

    # Security
    "OAuth", "JWT", "SSL/TLS", "SAML", "Zero Trust",
}

# Build case-insensitive lookup map
_KEYWORD_MAP = {kw.lower(): kw for kw in TECH_KEYWORDS}


def extract_tech_tags(text: str) -> List[str]:
    """
    Scans a job description string and returns a list of recognized tech tags.
    Case-insensitive. Deduplicates results.
    """
    if not text:
        return []

    found = set()
    text_lower = text.lower()

    for keyword_lower, keyword_display in _KEYWORD_MAP.items():
        # Use word boundary matching to avoid partial matches
        pattern = r"\b" + re.escape(keyword_lower) + r"\b"
        if re.search(pattern, text_lower):
            found.add(keyword_display)

    return sorted(found)
