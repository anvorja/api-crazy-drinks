import { Controller, Get, Header, Param, StreamableFile } from '@nestjs/common';
import {
  ApiOperation,
  ApiProduces,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import {
  ApiErrors,
  ApiParamFrom,
  ApiResponseFrom,
} from '../../../shared/infrastructure/http/openapi.js';
import { Cacheable } from '../../../shared/infrastructure/http/cache-control.js';
import { ZodValidationPipe } from '../../../shared/infrastructure/http/zod-validation.pipe.js';
import { GetSharedTaste } from '../../application/use-cases/taste-share.js';
import { renderTasteCardPng, renderTasteCardSvg } from '../cards/taste-card.js';
import {
  publicTasteResponseSchema,
  tasteSlugSchema,
  toPublicTasteResponse,
} from './dto/taste-share.dto.js';

const slugPipe = new ZodValidationPipe(tasteSlugSchema);

/** Public, no credentials: what a shared link opens. */
@ApiTags('Public · ADN compartido')
@Controller('taste')
export class PublicTasteController {
  constructor(private readonly getSharedTaste: GetSharedTaste) {}

  @Get(':slug')
  @Cacheable()
  @ApiOperation({
    summary: 'A shared taste profile',
    description:
      'Public: only the chosen display name and the flavor profile, never account data.',
  })
  @ApiParamFrom('slug', tasteSlugSchema, 'Share slug')
  @ApiResponseFrom(200, publicTasteResponseSchema, 'The profile')
  @ApiErrors(400, 404)
  async profile(@Param('slug', slugPipe) slug: string) {
    const { share, taste } = await this.getSharedTaste.execute(slug);
    return toPublicTasteResponse(share, taste);
  }

  @Get(':slug/card.svg')
  @Cacheable()
  @Header('Content-Type', 'image/svg+xml; charset=utf-8')
  @ApiOperation({
    summary: 'Shareable card (SVG)',
    description:
      'Radar of the 9 flavors, personality and favorite ingredients. 1200×630.',
  })
  @ApiParamFrom('slug', tasteSlugSchema, 'Share slug')
  @ApiProduces('image/svg+xml')
  @ApiResponse({
    status: 200,
    description: 'SVG image',
    content: { 'image/svg+xml': { schema: { type: 'string' } } },
  })
  @ApiErrors(400, 404)
  async cardSvg(@Param('slug', slugPipe) slug: string) {
    const { share, taste } = await this.getSharedTaste.execute(slug);
    return renderTasteCardSvg(share.displayName, taste);
  }

  @Get(':slug/card.png')
  @Cacheable()
  @ApiOperation({
    summary: 'Shareable card (PNG)',
    description:
      'Same card as PNG, 1200×630: use it as og:image so WhatsApp, X or Instagram show a preview.',
  })
  @ApiParamFrom('slug', tasteSlugSchema, 'Share slug')
  @ApiProduces('image/png')
  @ApiResponse({
    status: 200,
    description: 'PNG image',
    content: { 'image/png': { schema: { type: 'string', format: 'binary' } } },
  })
  @ApiErrors(400, 404)
  async cardPng(@Param('slug', slugPipe) slug: string) {
    const { share, taste } = await this.getSharedTaste.execute(slug);
    // A Buffer would be sent as JSON; StreamableFile sends the raw bytes.
    return new StreamableFile(
      renderTasteCardPng(renderTasteCardSvg(share.displayName, taste)),
      {
        type: 'image/png',
      },
    );
  }
}
