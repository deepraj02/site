---
author: Deepraj Baidya
pubDatetime: 2023-06-27T15:22:00Z
title: Build and Push your First Docker Image to Docker Hub 🐳
slug: how-to-build-and-push-docker-image
featured: false
draft: false
tags:
  - docker
  - container
  - container
  - docker-hub

description: We will delve into the world of container registries, with a focus on Docker Hub as the central hub for image distribution and collaboration.
---

In this journey, we will explore the intricacies of building Docker images, from crafting the perfect Dockerfile to leveraging Docker's robust CLI commands. We will delve into the world of container registries, with a focus on Docker Hub as the central hub for image distribution and collaboration.

So, let's dive into the technical details, command-line magic, and best practices for containerization as we embark on this exciting journey together. Get ready to wield the power of Docker and elevate your development workflow to new heights! 🚀.

\*\*Considering you've Docker already installed on your Machine:

## STEPS:

1. ### Signing Up on [docker.com](http://docker.com)🤘.

   1. To Create a new account on Docker, first, navigate to [https://docker.com](https://docker.com), then click on the **Sign-in** button, which will later take you to the Sign-in Screen, then Click on the **Sign-Up** button which will take you to the Signup page.
   2. Enter your Details and Credentials and you're done 🎊, you've completed the first Step.

2. ### Project Set-Up🧑‍💻.

   For this tutorial we will be building a simple Docker Image with **Python**, we'll be using a Python library named **pygiflet** which converts ASCII text into ASCII art fonts.

   First, create a directory in your machine, navigate to it and open the directory in any fav editor of yours (I'm going with VS-Code)

```bash
mkdir <dir name>
```

```bash
cd <dir name>
```

```bash
code .
```

Now Create a file name `main.py` and add `pyfiglet` in your machine by running this command (if you don't have it installed already).

```bash
pip install pyfiglet
```

Now import the library into your `main.py`, here's the whole content

```python
import pyfiglet

print(pyfiglet.figlet_format("Hello Docker"))
```

This code prints the "Hello Docker" string into beautiful ASCII art.

Now create a **requirements.txt** which will contain the list of dependencies we will be needing to build the Image.

Your **requirements.txt** should look something like this

```markdown
pyfiglet==0.8.post1
```

After that create another file named **Dockerfile** and add these Instructions to it.

(_A Dockerfile is a text file that contains a set of instructions to build a Docker image. It serves as a blueprint for creating a containerized environment with all the necessary dependencies and configurations. Dockerfiles follow a specific syntax and consist of a series of instructions that are executed sequentially during the image build process._)

```dockerfile
# Use the Python 3.9 image based on Alpine Linux as the base image
FROM python:3.9-alpine

# Set the working directory inside the container to your directory name
WORKDIR /docker-image

# Copy the requirements.txt file from the host machine to the current working directory in the container
COPY requirements.txt .

# Install the Python packages listed in the requirements.txt file using pip
# The --no-cache-dir flag disables the cache for the package installation
RUN pip install --no-cache-dir -r requirements.txt

# Copy all the files from the host machine to the current working directory in the container
COPY . .

# Set the command to be executed when the container starts
# In this case, it runs the Python script main.py using the Python interpreter
CMD ["python", "main.py"]
```

And the Second part is done, we've set up the Project, and now let's move forward to the next part of the tutorial😁.

1. ### Building Images in Docker🐋

   Now for building the Image, Open your Terminal and type the following command from the directory which contains your project i.e.**Dockerfile, main.py** & **requirements.txt**.

```bash
docker build -t <image-name> .
```

Here's an explanation of what this command does

- `docker build`: This is the command to build a Docker image.
- `-t <image-name>`: The `-t` option is used to tag the image with a name. Tags are used to identify and label different versions or variants of an image.
- `.`: The period (`.`) At the end of the command specifies the build context. It represents the current directory, which contains the files needed for building the image. The build context includes the Dockerfile and any other files referenced in it.

After running this command you'll see such output:

![](https://cdn.hashnode.com/res/hashnode/image/upload/v1687881462376/e146179f-8b45-4674-9202-757f5e4e6a3b.png)

Congratulations 🎊, you've build your Docker Image.

Now to verify run this command and you'll see that the image is created with the name you specified in the previous command.

```bash
docker images
```

![](https://cdn.hashnode.com/res/hashnode/image/upload/v1687881626308/2badd700-6bb6-41af-9e1f-7501d1edbaa2.png)

1. ### Pushing Images to DockerHub 🚀

   Now that we have created our Docker image, it's time to publish it to Docker Hub. But before we do that, we need to log in to Docker Hub. To do that, we first need to create an access token.

   Log in to Docker Hub, click on your profile image, select Account Settings from the popup menu, click on Security in the left navigation, and then click New Access Token. Once you’ve generated an access token, copy it to your clipboard.

   Now head back to the terminal window, issue the command **docker login**, and enter your Docker Hub credentials (username and access token). If the login is successful, you should see a message that says "Login Succeeded."

   Next, we need to tag our Docker image with our Docker Hub username and repository name. To do this, issue the command

```bash
docker tag <image-name> <dockerhub-username>/<repository-name>:<tag>
```

Replace `<image-name>` with the name of the image you built. `<dockerhub-username>` is your DockerHub username, `<repository-name>` is the desired name for your repository, and `<tag>` is an optional tag for versioning or identification purposes.

Push the image to DockerHub: Use the `docker push` command to upload your image to DockerHub.

```bash
docker push <dockerhub-username>/<repository-name>:<tag>
```

Replace `<dockerhub-username>`, `<repository-name>`, and `<tag>` with the respective values you used in the previous steps.

Docker will authenticate your account, compress the image, and upload it to DockerHub. Once the process completes, your image will be available on DockerHub for others to use.

After you run this command you will see something like this in your DockerHub

![](https://cdn.hashnode.com/res/hashnode/image/upload/v1687884395681/f77cd608-e099-4fe3-a00c-57a6c947be57.png)

Congratulations 🎊, you've now successfully built and pushed your first Docker Image to DockerHub.

<div class="tenor-gif-embed" data-postid="24077037" data-share-method="host" data-aspect-ratio="1.77778" data-width="100%"><a href="https://tenor.com/view/woo-hoo-will-smith-welcome-to-earth-we-did-it-we-made-it-gif-24077037">Woo Hoo Will Smith GIF</a>from <a href="https://tenor.com/search/woo+hoo-gifs">Woo Hoo GIFs</a></div> <script type="text/javascript" async src="https://tenor.com/embed.js"></script>

### Conclusion:

In this tutorial, we embarked on an exciting journey of building and publishing a Docker image to DockerHub. We explored the seamless process of containerizing applications and leveraging Docker's power to distribute them effortlessly.

We began by crafting a Dockerfile, meticulously defining the environment, dependencies, and configurations required for our application. With the help of the `docker build` command, we transformed our Dockerfile into a fully-fledged Docker image, ready to be shared with the world.

To ensure clarity and version control, we learned the importance of tagging our images appropriately. By utilizing the `docker tag` command, we assigned meaningful names and tags to our images, making them easily identifiable and accessible to others.

Finally, we embraced the magic of DockerHub by pushing our images to this versatile container registry. With the `docker push` command, we effortlessly published our Docker image, making it available for collaboration, deployment, and distribution.

By following this tutorial, you have gained the knowledge and skills to confidently navigate the process of building and publishing Docker images to DockerHub. With each step, you have unlocked the potential to share your containerized applications, collaborate with teammates, and contribute to the vibrant Docker community.

Now, armed with this newfound understanding, you can embark on your own Docker journey. Whether you're a developer sharing your innovative creations or a system administrator seeking efficient ways to deploy solutions, DockerHub provides a robust platform to amplify your impact.

So, let your imagination run wild as you build, publish, and share your Docker images with the world. Embrace the power of containers and the convenience of DockerHub, knowing that your applications are ready to soar to new heights.

Happy Dockerizing! 🐳🚀.
