FROM centos:8

RUN dnf install -y epel-release && \
    dnf install -y nodejs npm && \
    dnf clean all

WORKDIR /app

# Copy dependency files first
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy the rest of your app
COPY . .

EXPOSE 8000

CMD ["node", "app.js"]
