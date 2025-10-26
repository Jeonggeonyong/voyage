FROM python:3.10-slim
WORKDIR /app
RUN pip install Flask requests
COPY . .
ENV FLASK_APP=risk-analysis.py
EXPOSE 3000
CMD ["flask", "run", "--host=0.0.0.0", "--port=3000"]
