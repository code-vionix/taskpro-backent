import { Controller, Get, Param, Res } from '@nestjs/common';
import type { Response } from 'express';
import { PostsService } from './posts.service';

@Controller('public/posts')
export class PublicPostsController {
  constructor(private readonly postsService: PostsService) {}

  @Get(':id')
  async getOne(@Param('id') id: string) {
      return this.postsService.findOne(id);
  }

  @Get(':id/share-view')
  async shareView(@Param('id') id: string, @Res() res: Response) {
    try {
      const post = await this.postsService.findOne(id);
      
      // Determine image URL
      const imageUrl = post.imageUrl || 'https://via.placeholder.com/1200x630?text=No+Image';
      
      // Post Title/Description (truncate if needed)
      const title = post.content ? post.content.substring(0, 50) + (post.content.length > 50 ? '...' : '') : 'New Post';
      const description = post.content ? post.content.substring(0, 200) : 'Check out this post!';
      
      // Frontend URL - Fallback to current host if not defined, or hardcoded dev default
      // Ideally this comes from env. 
      // We will assume the frontend is running on localhost:5173 for dev if not set.
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
      const redirectUrl = `${frontendUrl}/posts/${id}`;

      // Construct HTML with OG Tags
      const html = `
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>${title}</title>
            
            <meta property="og:title" content="${title}" />
            <meta property="og:description" content="${description}" />
            <meta property="og:image" content="${imageUrl}" />
            <meta property="og:url" content="${redirectUrl}" />
            <meta property="og:type" content="article" />
            
            <meta name="twitter:card" content="summary_large_image">
            <meta name="twitter:title" content="${title}">
            <meta name="twitter:description" content="${description}">
            <meta name="twitter:image" content="${imageUrl}">

            <script>
                window.location.href = "${redirectUrl}";
            </script>
        </head>
        <body>
            <p>Redirecting to post...</p>
        </body>
        </html>
      `;

      res.set('Content-Type', 'text/html');
      return res.send(html);
    } catch (error) {
       // Fallback to frontend home if post not found
       const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
       return res.redirect(frontendUrl);
    }
  }
}
