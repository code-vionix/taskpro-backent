
export class CreateTaskDto {
  title: string;
  description?: string;
  startTime: Date;
  endTime: Date;
}
export class UpdateTaskDto extends CreateTaskDto {}
