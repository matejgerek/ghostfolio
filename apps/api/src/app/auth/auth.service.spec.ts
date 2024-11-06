import { UserService } from '@ghostfolio/api/app/user/user.service';
import { ConfigurationService } from '@ghostfolio/api/services/configuration/configuration.service';
import { PropertyService } from '@ghostfolio/api/services/property/property.service';

import { InternalServerErrorException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Provider } from '@prisma/client';

import { AuthService } from './auth.service';

describe('AuthService', () => {
  let authService: AuthService;
  let configurationService: jest.Mocked<ConfigurationService>;
  let jwtService: jest.Mocked<JwtService>;
  let propertyService: jest.Mocked<PropertyService>;
  let userService: jest.Mocked<UserService>;

  beforeEach(() => {
    configurationService = {
      get: jest.fn()
    } as any;

    jwtService = {
      sign: jest.fn()
    } as any;

    propertyService = {
      isUserSignupEnabled: jest.fn()
    } as any;

    userService = {
      createAccessToken: jest.fn(),
      users: jest.fn(),
      createUser: jest.fn()
    } as any;

    authService = new AuthService(
      configurationService,
      jwtService,
      propertyService,
      userService
    );
  });

  describe('validateAnonymousLogin', () => {
    it('should validate and return JWT for existing user', async () => {
      const mockAccessToken = 'test-token';
      const mockHashedToken = 'hashed-token';
      const mockUser = { id: 'user-1' };
      const mockJwt = 'signed-jwt';

      configurationService.get.mockReturnValue('salt');
      userService.createAccessToken.mockReturnValue(mockHashedToken);
      userService.users.mockResolvedValue([mockUser as any]);
      jwtService.sign.mockReturnValue(mockJwt);

      const result = await authService.validateAnonymousLogin(mockAccessToken);

      expect(result).toBe(mockJwt);
      expect(userService.createAccessToken).toHaveBeenCalledWith(
        mockAccessToken,
        'salt'
      );
      expect(userService.users).toHaveBeenCalledWith({
        where: { accessToken: mockHashedToken }
      });
      expect(jwtService.sign).toHaveBeenCalledWith({ id: mockUser.id });
    });

    it('should reject if user not found', async () => {
      userService.users.mockResolvedValue([]);

      await expect(
        authService.validateAnonymousLogin('token')
      ).rejects.toBeUndefined();
    });
  });

  describe('validateInternetIdentityLogin', () => {
    it('should create new user and return JWT when signup enabled', async () => {
      const principalId = 'principal-1';
      const mockUser = { id: 'user-1' };
      const mockJwt = 'signed-jwt';

      userService.users.mockResolvedValue([]);
      propertyService.isUserSignupEnabled.mockResolvedValue(true);
      userService.createUser.mockResolvedValue(mockUser as any);
      jwtService.sign.mockReturnValue(mockJwt);

      const result =
        await authService.validateInternetIdentityLogin(principalId);

      expect(result).toBe(mockJwt);
      expect(userService.users).toHaveBeenCalledWith({
        where: {
          provider: Provider.INTERNET_IDENTITY,
          thirdPartyId: principalId
        }
      });
      expect(userService.createUser).toHaveBeenCalledWith({
        data: {
          provider: Provider.INTERNET_IDENTITY,
          thirdPartyId: principalId
        }
      });
      expect(jwtService.sign).toHaveBeenCalledWith({ id: mockUser.id });
    });

    it('should return JWT for existing user', async () => {
      const principalId = 'principal-1';
      const mockUser = { id: 'user-1' };
      const mockJwt = 'signed-jwt';

      userService.users.mockResolvedValue([mockUser as any]);
      jwtService.sign.mockReturnValue(mockJwt);

      const result =
        await authService.validateInternetIdentityLogin(principalId);

      expect(result).toBe(mockJwt);
      expect(userService.createUser).not.toHaveBeenCalled();
    });

    it('should throw if signup disabled and user not found', async () => {
      userService.users.mockResolvedValue([]);
      propertyService.isUserSignupEnabled.mockResolvedValue(false);

      await expect(
        authService.validateInternetIdentityLogin('principal-1')
      ).rejects.toThrow(InternalServerErrorException);
    });
  });

  describe('validateOAuthLogin', () => {
    it('should create new user and return JWT when signup enabled', async () => {
      const mockParams = {
        provider: Provider.GOOGLE,
        thirdPartyId: 'google-id'
      };
      const mockUser = { id: 'user-1' };
      const mockJwt = 'signed-jwt';

      userService.users.mockResolvedValue([]);
      propertyService.isUserSignupEnabled.mockResolvedValue(true);
      userService.createUser.mockResolvedValue(mockUser as any);
      jwtService.sign.mockReturnValue(mockJwt);

      const result = await authService.validateOAuthLogin(mockParams);

      expect(result).toBe(mockJwt);
      expect(userService.createUser).toHaveBeenCalledWith({
        data: mockParams
      });
    });

    it('should return JWT for existing user', async () => {
      const mockParams = {
        provider: Provider.GOOGLE,
        thirdPartyId: 'google-id'
      };
      const mockUser = { id: 'user-1' };
      const mockJwt = 'signed-jwt';

      userService.users.mockResolvedValue([mockUser as any]);
      jwtService.sign.mockReturnValue(mockJwt);

      const result = await authService.validateOAuthLogin(mockParams);

      expect(result).toBe(mockJwt);
      expect(userService.createUser).not.toHaveBeenCalled();
    });

    it('should throw if signup disabled and user not found', async () => {
      const mockParams = {
        provider: Provider.GOOGLE,
        thirdPartyId: 'google-id'
      };

      userService.users.mockResolvedValue([]);
      propertyService.isUserSignupEnabled.mockResolvedValue(false);

      await expect(authService.validateOAuthLogin(mockParams)).rejects.toThrow(
        InternalServerErrorException
      );
    });
  });
});
