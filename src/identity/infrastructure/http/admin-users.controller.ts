import { Body, Controller, Get, Param, Patch, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  ApiBearer,
  ApiBodyFrom,
  ApiErrors,
  ApiParamFrom,
  ApiQueryFrom,
  ApiResponseFrom,
} from '../../../shared/infrastructure/http/openapi.js';
import { ZodValidationPipe } from '../../../shared/infrastructure/http/zod-validation.pipe.js';
import {
  ChangeUserRole,
  ListUsers,
} from '../../application/use-cases/users.js';
import type { Principal } from '../../domain/principal.js';
import { CurrentPrincipal, Roles } from './auth.decorators.js';
import type {
  ChangeRoleBodyDto,
  ListUsersQueryDto,
} from './dto/auth-requests.dto.js';
import {
  changeRoleBodySchema,
  listUsersQuerySchema,
  userIdSchema,
} from './dto/auth-requests.dto.js';
import {
  toUserResponse,
  userListResponseSchema,
  userResponseSchema,
} from './dto/auth-responses.dto.js';

@ApiTags('Admin')
@ApiBearer()
@ApiErrors(403)
@Controller('admin/users')
@Roles('admin')
export class AdminUsersController {
  constructor(
    private readonly listUsers: ListUsers,
    private readonly changeUserRole: ChangeUserRole,
  ) {}

  @Get()
  @ApiOperation({ summary: 'List users' })
  @ApiQueryFrom(listUsersQuerySchema)
  @ApiResponseFrom(200, userListResponseSchema, 'Users, oldest first')
  @ApiErrors(400)
  async list(
    @CurrentPrincipal() actor: Principal,
    @Query(new ZodValidationPipe(listUsersQuerySchema))
    query: ListUsersQueryDto,
  ) {
    return (await this.listUsers.execute(actor, query)).map((u) =>
      toUserResponse(u),
    );
  }

  @Patch(':id/role')
  @ApiOperation({
    summary: "Change a user's role",
    description:
      "Takes effect on the user's next token refresh. Admins cannot remove their own admin role.",
  })
  @ApiParamFrom('id', userIdSchema, 'User id')
  @ApiBodyFrom(changeRoleBodySchema)
  @ApiResponseFrom(200, userResponseSchema, 'Updated user')
  @ApiErrors(400, 404)
  async changeRole(
    @CurrentPrincipal() actor: Principal,
    @Param('id', new ZodValidationPipe(userIdSchema)) id: string,
    @Body(new ZodValidationPipe(changeRoleBodySchema)) body: ChangeRoleBodyDto,
  ) {
    return toUserResponse(
      await this.changeUserRole.execute(actor, id, body.role),
    );
  }
}
