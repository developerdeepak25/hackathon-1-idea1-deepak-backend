import { IsEmail, IsString, Length, MinLength } from 'class-validator';

export class RegisterGuestDto {
  @IsEmail()
  email!: string;

  @IsString()
  @Length(2, 80)
  name!: string;

  @IsString()
  @MinLength(8)
  password!: string;
}

export class LoginGuestDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(1)
  password!: string;
}
