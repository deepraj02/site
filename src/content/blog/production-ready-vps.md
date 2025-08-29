---
author: Deepraj Baidya
pubDatetime: 2025-03-27T15:22:00Z
title: Production Ready VPS in Minutes
slug: production-ready-vps
featured: true
draft: false
tags:
  - vps
  - digitalocean
  - ssh
  - production
  - server
  - secutiry
  - firewall
  - linux

description: A practical guide to securing VPS's for production use. Covers essential hardening steps including user management, SSH key authentication, access restrictions, and configuration best practices. Addresses security benefits and operational trade-offs for system administrators deploying secure server infrastructure.
---

When deploying a Virtual Private Server (VPS) for production use, security should be your top priority. A freshly provisioned server comes with default configurations that prioritize accessibility over security—fine for development, but dangerous in production environments. This guide walks you through essential hardening steps that transform your VPS from vulnerable to production-ready.


Before everything else we need a VPS, for which we will be using [DigitalOcean](https://www.digitalocean.com/), here's a quick tutorial on how to create a Droplet on DigitalOcean.

<div style="position: relative; padding-bottom: 56.25%; height: 0; overflow: hidden;">
  <iframe style="position: absolute; top: 0; left: 0; width: 100%; height: 100%;" src="https://www.youtube.com/embed/g1-nQ9pvbxc" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>
</div>


Now let's get into securing and making our VPS Production ready.

### 1. Initial System Updates

``` bash
sudo apt update && sudo apt upgrade -y
shutdown now -r
```
#### Why this matters: 
Fresh server images often contain outdated packages with known vulnerabilities. The first line updates your package lists and upgrades all installed packages to their latest versions. The immediate reboot ensures any kernel updates take effect and that your server starts clean with the latest security patches.

> **Best practice**: Always perform this step before making any configuration changes, as package updates can sometimes reset configuration files.


### 2. Creating a Dedicated User Account

```bash
sudo adduser <username>
sudo usermod -aG sudo <username>
su - <username>
```
> NOTE: Change the <username> with the username you want to add

Running administrative tasks as root violates the principle of least privilege. By creating a dedicated user account, you reduce the blast radius of potential security breaches and create an audit trail for administrative actions.

#### What happens here :

- `adduser` creates a new user with a home directory
- `usermod -aG sudo` grants the user administrative privileges through the sudo group
- `su - <username>` switches to the new user context


### 3. SSH Key Authentication Setup

```bash
mkdir -p ~/.ssh
chmod 700 ~/.ssh
touch ~/.ssh/authorized_keys
echo "your_public_key_here" > ~/.ssh/authorized_keys
chmod 600 ~/.ssh/authorized_keys
```

Password authentication is inherently weak—passwords can be brute-forced, guessed, or compromised through data breaches. SSH keys provide cryptographic authentication that's exponentially more secure.

#### Directory permissions explained:

- `700` on .ssh directory: Only the owner can read, write, or execute
- `600` on authorized_keys: Only the owner can read or write the file

These restrictive permissions are crucial—SSH will refuse to use keys with overly permissive access.


### 4. SSH Hardening Configuration

```bash
sudo vi /etc/ssh/sshd_config
```

#### Critical configuration changes (sshd_config) file:
```bash
PermitRootLogin no
usePAM no  
PasswordAuthentication no
```
exit the file and then on your terminal
```bash
sudo systemctl restart ssh
```

#### Why this matters

- `PermitRootLogin no`: Prevents direct root access via SSH, forcing attackers to compromise a user account first, then escalate privileges

- `usePAM no`: Disables Pluggable Authentication Modules for SSH, reducing the attack surface

- `PasswordAuthentication no`: Completely disables password-based authentication, making brute-force attacks ineffective

> **Important:** Test your SSH key authentication before implementing these changes. Once password authentication is disabled, key-based access becomes your only entry method.

One additional hardening measure worth considering is changing SSH from its default port 22 to a custom port. While this provides security benefits, it comes with significant operational overhead (we're not going to cover it in this blog).

### 5. Streamlined SSH Access

Most of our configuration is done, but we can still make the process of connecting to our VPS a bit more smooth, see now everytime we need to connect to our VPS we have to pass the private-key, here a fix for that.

In your local machine's terminal

```bash
vi ~/.ssh/config
```

SSH config file:
```bash
Host your-server-nickname
    HostName your_server_ip
    User <username>
    IdentityFile path_to_your_private_key
    IdentitiesOnly yes
```
> **NOTE:** The username should be the same that we created in step 2 of this tutorial.

#### Benefits:
Operational benefits:

- Now you can just use `ssh server-nickname` instead of lengthy commands to connect to your VPS.

- `IdentitiesOnly yes`: Prevents SSH from trying multiple keys, reducing authentication noise in logs.

- Ensures the same key and user are always used for this server.


### Additional Security Considerations:

While this guide covers fundamental hardening steps, consider these additional measures for enhanced security:

- **Fail2ban**: Automatically blocks IPs after failed authentication attempts

- **UFW (Uncomplicated Firewall)**: Restricts network access to necessary ports only

- SSH port changes: Move SSH from default port 22 to reduce automated attacks


### Key Takeaways:

This configuration establishes multiple security layers: eliminating weak authentication methods, restricting privileged access, and implementing cryptographic verification. Each step addresses specific attack vectors commonly exploited in server breaches.

