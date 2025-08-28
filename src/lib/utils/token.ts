import { models } from "@/lib/db";
import { Op } from "sequelize";

/**
 * Verify if a token is valid
 */
export async function verifyToken(
  token: string
): Promise<{ valid: boolean; pilotId?: number }> {
  try {
    // Find token in database
    const tokenRecord = await models.Token.findOne({
      where: { token },
    });

    // Check if token exists
    if (!tokenRecord) {
      return { valid: false };
    }

    // Check if token is expired
    if (new Date() > tokenRecord.expiresAt) {
      return { valid: false };
    }

    // Check if token is revoked
    if (tokenRecord.isRevoked) {
      return { valid: false };
    }

    return { valid: true, pilotId: tokenRecord.pilotId };
  } catch (error) {
    console.error("Error verifying token:", error);
    return { valid: false };
  }
}

/**
 * Revoke a token
 */
export async function revokeToken(token: string): Promise<boolean> {
  try {
    // Find token in database
    const tokenRecord = await models.Token.findOne({
      where: { token },
    });

    // Check if token exists
    if (!tokenRecord) {
      return false;
    }

    // Revoke token
    tokenRecord.isRevoked = true;
    await tokenRecord.save();

    return true;
  } catch (error) {
    console.error("Error revoking token:", error);
    return false;
  }
}

/**
 * Revoke all tokens for a pilot
 */
export async function revokeAllTokens(pilotId: number): Promise<boolean> {
  try {
    // Update all tokens for the pilot
    await models.Token.update({ isRevoked: true }, { where: { pilotId } });

    return true;
  } catch (error) {
    console.error("Error revoking all tokens:", error);
    return false;
  }
}

/**
 * Clean up expired tokens
 */
export async function cleanupExpiredTokens(): Promise<number> {
  try {
    // Delete all expired tokens
    const result = await models.Token.destroy({
      where: {
        expiresAt: { [Op.lt]: new Date() },
      },
    });

    return result;
  } catch (error) {
    console.error("Error cleaning up expired tokens:", error);
    return 0;
  }
}
