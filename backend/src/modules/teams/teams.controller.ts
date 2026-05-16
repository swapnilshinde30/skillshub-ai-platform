import {
  Controller, Get, Post, Put, Delete, Param, Body,
  ParseUUIDPipe, HttpCode, HttpStatus,
} from '@nestjs/common';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { UserRole } from '../../common/enums';
import { JwtPayload } from '../auth/dto/jwt-payload.interface';
import { TeamsService } from './teams.service';
import { CreateTeamDto, AddRoleDto, UpdateTeamDto, AssignRoleDto, SetSelectionsDto } from './dto/teams.dto';

@Controller('teams')
@Roles(UserRole.HR)
export class TeamsController {
  constructor(private readonly teamsService: TeamsService) {}

  @Post()
  create(@Body() dto: CreateTeamDto, @CurrentUser() user: JwtPayload) {
    return this.teamsService.create(user.sub, dto);
  }

  @Get()
  list(@CurrentUser() user: JwtPayload) {
    return this.teamsService.list(user.sub);
  }

  @Get(':id')
  getOne(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: JwtPayload) {
    return this.teamsService.getOne(id, user.sub);
  }

  @Put(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateTeamDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.teamsService.update(id, user.sub, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: JwtPayload) {
    return this.teamsService.remove(id, user.sub);
  }

  @Post(':id/roles')
  addRole(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AddRoleDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.teamsService.addRole(id, user.sub, dto);
  }

  @Delete(':id/roles/:roleId')
  @HttpCode(HttpStatus.NO_CONTENT)
  removeRole(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('roleId', ParseUUIDPipe) roleId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.teamsService.removeRole(id, roleId, user.sub);
  }

  /** HR saves all selections for a role at once (replaces previous picks) */
  @Put(':id/roles/:roleId/selections')
  setSelections(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('roleId', ParseUUIDPipe) roleId: string,
    @Body() dto: SetSelectionsDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.teamsService.setRoleSelections(id, roleId, user.sub, dto);
  }

  /** HR selects a matched candidate for a specific role */
  @Post(':id/roles/:roleId/assign')
  assignToRole(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('roleId', ParseUUIDPipe) roleId: string,
    @Body() dto: AssignRoleDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.teamsService.assignToRole(id, roleId, user.sub, dto);
  }

  @Post(':id/build')
  buildTeam(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: JwtPayload) {
    return this.teamsService.buildTeam(id, user.sub);
  }

  @Post(':id/reset')
  resetTeam(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: JwtPayload) {
    return this.teamsService.resetTeam(id, user.sub);
  }
}
