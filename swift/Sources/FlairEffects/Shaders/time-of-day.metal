// flair-metal-hash: cd7853aa
#pragma clang diagnostic ignored "-Wunused-variable"
#pragma clang diagnostic ignored "-Wunused-const-variable"
#pragma clang diagnostic ignored "-Wmissing-prototypes"

#include <metal_stdlib>
#include <simd/simd.h>

using namespace metal;

// Implementation of the GLSL mod() function, which is slightly different than Metal fmod()
template<typename Tx, typename Ty>
inline Tx mod(Tx x, Ty y)
{
    return x - y * floor(x / y);
}

struct FlairUniforms
{
    packed_float3 iResolution;
    float iTime;
    float iTimeDelta;
    int iFrame;
    float iBeat;
    float flair_flipY;
    float4 iMouse;
    float4 iPointer;
    float4 iClicks[8];
    float4 iTrail[32];
    float4 iAudio;
    float4 iSpectrum[16];
    float4 iScroll;
    float uHour;
    float uSpeed;
    float uStrength;
    float uSkyTint;
    float uNightLights;
    char _m18_pad[12];
    packed_float3 uLampColor;
    float uThreshold;
    packed_float3 uBackdrop;
    float uBackdropAlpha;
};

struct flair_time_of_day_frag_out
{
    float4 flair_FragColor [[color(0)]];
};

static inline __attribute__((always_inline))
float4 overBackdrop(thread const float4& s, constant FlairUniforms& _85)
{
    float3 colour = fast::min(s.xyz, float3(s.w)) + ((float3(_85.uBackdrop) * _85.uBackdropAlpha) * (1.0 - s.w));
    float alpha = s.w + (_85.uBackdropAlpha * (1.0 - s.w));
    return float4(colour / float3(fast::max(alpha, 9.9999997473787516355514526367188e-05)), alpha);
}

static inline __attribute__((always_inline))
float3 testCard(thread const float2& uv)
{
    float3 sky = mix(float3(0.980000019073486328125, 0.62000000476837158203125, 0.4199999868869781494140625), float3(0.23999999463558197021484375, 0.319999992847442626953125, 0.7200000286102294921875), float3(uv.y));
    float sun = smoothstep(0.1599999964237213134765625, 0.1500000059604644775390625, length((uv - float2(0.64999997615814208984375, 0.579999983310699462890625)) * float2(1.60000002384185791015625, 1.0)));
    float hills = step(uv.y, (0.319999992847442626953125 + (0.0599999986588954925537109375 * sin(uv.x * 9.0))) + (0.039999999105930328369140625 * sin((uv.x * 23.0) + 1.0)));
    float3 col = mix(sky, float3(1.0, 0.920000016689300537109375, 0.699999988079071044921875), float3(sun));
    col = mix(col, float3(0.119999997317790985107421875, 0.2800000011920928955078125, 0.23999999463558197021484375) + float3(0.07999999821186065673828125 * sin(uv.x * 40.0)), float3(hills));
    float2 grid = abs(fract(uv * 8.0) - float2(0.5));
    col += float3(0.039999999105930328369140625 * step(0.4799999892711639404296875, fast::max(grid.x, grid.y)));
    return col;
}

static inline __attribute__((always_inline))
float4 pictureRGBA(texture2d<float> tex, sampler texSmplr, thread const float2& uv, constant FlairUniforms& _85)
{
    float4 _229;
    if (int2(tex.get_width(), tex.get_height()).x > 1)
    {
        float4 param = tex.sample(texSmplr, uv);
        _229 = overBackdrop(param, _85);
    }
    else
    {
        float2 param_1 = fract(uv);
        _229 = float4(testCard(param_1), 1.0);
    }
    return _229;
}

static inline __attribute__((always_inline))
float luma(thread const float3& c)
{
    return dot(c, float3(0.2125999927520751953125, 0.715200006961822509765625, 0.072200000286102294921875));
}

static inline __attribute__((always_inline))
float heightAt(thread const float2& uv, thread const float& lod, texture2d<float> uImage, sampler uImageSmplr)
{
    float3 _256;
    if (int2(uImage.get_width(), uImage.get_height()).x > 1)
    {
        _256 = uImage.sample(uImageSmplr, uv, level(lod)).xyz;
    }
    else
    {
        float2 param = fract(uv);
        _256 = testCard(param);
    }
    float3 c = _256;
    return dot(c, float3(0.2125999927520751953125, 0.715200006961822509765625, 0.072200000286102294921875));
}

static inline __attribute__((always_inline))
float2 heightSlope(thread const float2& uv, constant FlairUniforms& _85, texture2d<float> uImage, sampler uImageSmplr)
{
    int2 size = int2(uImage.get_width(), uImage.get_height());
    float2 _288;
    if (size.x > 1)
    {
        _288 = float2(1.0) / float2(size);
    }
    else
    {
        _288 = float2(1.0) / float2(_85.iResolution[0], _85.iResolution[1]);
    }
    float2 texel = _288;
    float _306;
    if (size.x > 1)
    {
        _306 = float(size.y);
    }
    else
    {
        _306 = _85.iResolution[1u];
    }
    float texH = _306;
    float2 d = texel * 1.5;
    float2 param = uv + float2(-d.x, d.y);
    float param_1 = 0.0;
    float tl = heightAt(param, param_1, uImage, uImageSmplr);
    float2 param_2 = uv + float2(0.0, d.y);
    float param_3 = 0.0;
    float tc = heightAt(param_2, param_3, uImage, uImageSmplr);
    float2 param_4 = uv + d;
    float param_5 = 0.0;
    float tr = heightAt(param_4, param_5, uImage, uImageSmplr);
    float2 param_6 = uv - float2(d.x, 0.0);
    float param_7 = 0.0;
    float ml = heightAt(param_6, param_7, uImage, uImageSmplr);
    float2 param_8 = uv + float2(d.x, 0.0);
    float param_9 = 0.0;
    float mr = heightAt(param_8, param_9, uImage, uImageSmplr);
    float2 param_10 = uv - d;
    float param_11 = 0.0;
    float bl = heightAt(param_10, param_11, uImage, uImageSmplr);
    float2 param_12 = uv - float2(0.0, d.y);
    float param_13 = 0.0;
    float bc = heightAt(param_12, param_13, uImage, uImageSmplr);
    float2 param_14 = uv + float2(d.x, -d.y);
    float param_15 = 0.0;
    float br = heightAt(param_14, param_15, uImage, uImageSmplr);
    float2 fine = float2(((((tr + (2.0 * mr)) + br) - tl) - (2.0 * ml)) - bl, ((((tl + (2.0 * tc)) + tr) - bl) - (2.0 * bc)) - br) * 0.125;
    float s1 = 0.0199999995529651641845703125 * texH;
    float2 d1 = texel * s1;
    float l1 = log2(fast::max(s1, 1.0));
    float2 param_16 = uv + float2(d1.x, 0.0);
    float param_17 = l1;
    float2 param_18 = uv - float2(d1.x, 0.0);
    float param_19 = l1;
    float2 param_20 = uv + float2(0.0, d1.y);
    float param_21 = l1;
    float2 param_22 = uv - float2(0.0, d1.y);
    float param_23 = l1;
    float2 mid = float2(heightAt(param_16, param_17, uImage, uImageSmplr) - heightAt(param_18, param_19, uImage, uImageSmplr), heightAt(param_20, param_21, uImage, uImageSmplr) - heightAt(param_22, param_23, uImage, uImageSmplr)) * 0.5;
    float s2 = 0.07999999821186065673828125 * texH;
    float2 d2 = texel * s2;
    float l2 = log2(fast::max(s2, 1.0));
    float2 param_24 = uv + float2(d2.x, 0.0);
    float param_25 = l2;
    float2 param_26 = uv - float2(d2.x, 0.0);
    float param_27 = l2;
    float2 param_28 = uv + float2(0.0, d2.y);
    float param_29 = l2;
    float2 param_30 = uv - float2(0.0, d2.y);
    float param_31 = l2;
    float2 broad = float2(heightAt(param_24, param_25, uImage, uImageSmplr) - heightAt(param_26, param_27, uImage, uImageSmplr), heightAt(param_28, param_29, uImage, uImageSmplr) - heightAt(param_30, param_31, uImage, uImageSmplr)) * 0.5;
    return ((fine * 0.5) + (mid * 0.60000002384185791015625)) + (broad * 0.60000002384185791015625);
}

static inline __attribute__((always_inline))
float3 surfaceNormal(thread const float2& uv, thread const float& strength, constant FlairUniforms& _85, texture2d<float> uImage, sampler uImageSmplr)
{
    float2 param = uv;
    return fast::normalize(float3((-heightSlope(param, _85, uImage, uImageSmplr)) * strength, 1.0));
}

static inline __attribute__((always_inline))
float2 shade(thread const float3& n, thread const float3& l, thread const float& shininess)
{
    float diff = fast::max(dot(n, l), 0.0);
    float3 h = fast::normalize(l + float3(0.0, 0.0, 1.0));
    float spec = powr(fast::max(dot(n, h), 0.0), shininess) * step(0.0, diff - 0.001000000047497451305389404296875);
    return float2(diff, spec);
}

static inline __attribute__((always_inline))
float glowAt(thread const float2& uv, thread const float& lod, constant FlairUniforms& _85, texture2d<float> uImage, sampler uImageSmplr)
{
    float3 _602;
    if (int2(uImage.get_width(), uImage.get_height()).x > 1)
    {
        _602 = uImage.sample(uImageSmplr, uv, level(lod)).xyz;
    }
    else
    {
        float2 param = fract(uv);
        _602 = testCard(param);
    }
    float3 c = _602;
    float3 param_1 = c;
    return smoothstep(_85.uThreshold, fast::min(_85.uThreshold + 0.25, 1.0), luma(param_1));
}

static inline __attribute__((always_inline))
float3 rolloff(thread const float3& c)
{
    return c / (float3(1.0) + fast::max(c - float3(1.0), float3(0.0)));
}

static inline __attribute__((always_inline))
void mainImage(thread float4& fragColor, thread const float2& fragCoord, constant FlairUniforms& _85, texture2d<float> uImage, sampler uImageSmplr)
{
    float2 uv = fragCoord / float2(_85.iResolution[0], _85.iResolution[1]);
    float hour = mod(_85.uHour + (_85.iTime * _85.uSpeed), 24.0);
    float arc = ((hour - 6.0) / 12.0) * 3.141590118408203125;
    float e = sin(arc);
    float across = -cos(arc);
    float morning = 1.0 - (smoothstep(10.0, 14.0, hour) * (1.0 - smoothstep(22.0, 24.0, hour)));
    float3 l = fast::normalize(float3(across, 0.25 + (0.60000002384185791015625 * fast::max(e, 0.0)), 0.20000000298023223876953125 + (0.89999997615814208984375 * fast::max(e, 0.0))));
    float day = smoothstep(-0.039999999105930328369140625, 0.2199999988079071044921875, e);
    float night = 1.0 - smoothstep(-0.37999999523162841796875, -0.119999997317790985107421875, e);
    float3 low = mix(float3(1.0, 0.5, 0.2199999988079071044921875), float3(1.0, 0.62000000476837158203125, 0.579999983310699462890625), float3(morning));
    float3 sun = mix(low, float3(1.0, 0.9700000286102294921875, 0.920000016689300537109375), float3(smoothstep(0.119999997317790985107421875, 0.64999997615814208984375, e)));
    float3 sky = mix(float3(0.0500000007450580596923828125, 0.070000000298023223876953125, 0.17000000178813934326171875), float3(0.23999999463558197021484375, 0.319999992847442626953125, 0.7200000286102294921875), float3(smoothstep(-0.4000000059604644775390625, -0.119999997317790985107421875, e)));
    sky = mix(sky, mix(float3(0.85000002384185791015625, 0.550000011920928955078125, 0.5), float3(0.800000011920928955078125, 0.62000000476837158203125, 0.699999988079071044921875), float3(morning)), float3(smoothstep(-0.119999997317790985107421875, 0.039999999105930328369140625, e)));
    sky = mix(sky, float3(0.62000000476837158203125, 0.7400000095367431640625, 1.0), float3(smoothstep(0.119999997317790985107421875, 0.550000011920928955078125, e)));
    float2 param = uv;
    float4 pic = pictureRGBA(uImage, uImageSmplr, param, _85);
    float3 param_1 = pic.xyz;
    float lum = luma(param_1);
    float3 albedo = mix(pic.xyz, float3(lum), float3(night * 0.550000011920928955078125));
    float2 param_2 = uv;
    float param_3 = _85.uStrength;
    float3 n = surfaceNormal(param_2, param_3, _85, uImage, uImageSmplr);
    float3 param_4 = n;
    float3 param_5 = l;
    float param_6 = 30.0;
    float2 s = shade(param_4, param_5, param_6);
    float3 col = (albedo * ((sky * mix(0.550000011920928955078125, 0.449999988079071044921875, day)) + ((sun * day) * (0.25 + (1.0 * s.x))))) + (((sun * day) * s.y) * 0.1500000059604644775390625);
    float3 param_7 = sky;
    float3 tint = sky / float3(fast::max(luma(param_7), 0.0500000007450580596923828125));
    col *= mix(float3(1.0), fast::clamp(tint, float3(0.0), float3(2.0)), float3(_85.uSkyTint * 0.4000000059604644775390625));
    float on = (1.0 - smoothstep(-0.2199999988079071044921875, 0.0199999995529651641845703125, e)) * _85.uNightLights;
    float2 param_8 = uv;
    float param_9 = 0.0;
    float lamp = glowAt(param_8, param_9, _85, uImage, uImageSmplr);
    float2 param_10 = uv;
    float param_11 = 3.0;
    float2 param_12 = uv;
    float param_13 = 5.0;
    float halo = (glowAt(param_10, param_11, _85, uImage, uImageSmplr) * 0.60000002384185791015625) + (glowAt(param_12, param_13, _85, uImage, uImageSmplr) * 0.5);
    col += ((float3(_85.uLampColor) * on) * ((lamp * (0.60000002384185791015625 + (0.60000002384185791015625 * lum))) + (halo * 0.5)));
    float3 param_14 = col;
    fragColor = float4(rolloff(param_14), pic.w);
}

fragment flair_time_of_day_frag_out flair_time_of_day_frag(constant FlairUniforms& _85 [[buffer(0)]], texture2d<float> uImage [[texture(1)]], sampler uImageSmplr [[sampler(1)]], float4 gl_FragCoord [[position]])
{
    flair_time_of_day_frag_out out = {};
    float4 flair_color = float4(0.0, 0.0, 0.0, 1.0);
    float _890;
    if (_85.flair_flipY > 0.5)
    {
        _890 = _85.iResolution[1u] - gl_FragCoord.y;
    }
    else
    {
        _890 = gl_FragCoord.y;
    }
    float2 flair_coord = float2(gl_FragCoord.x, _890);
    float2 param_1 = flair_coord;
    float4 param;
    mainImage(param, param_1, _85, uImage, uImageSmplr);
    flair_color = param;
    out.flair_FragColor = flair_color;
    return out;
}

