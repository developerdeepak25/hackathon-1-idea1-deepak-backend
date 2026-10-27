import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

@Schema({ timestamps: true })
export class Guest {
  @Prop({ type: String, required: true, unique: true, lowercase: true, trim: true })
  email!: string;

  @Prop({ type: String, required: true })
  name!: string;

  @Prop({ type: String, required: true })
  passwordHash!: string;

  @Prop({ type: String, required: true })
  passwordSalt!: string;
}

export type GuestDoc = HydratedDocument<Guest>;
export const GuestSchema = SchemaFactory.createForClass(Guest);
