// flair-metal-hash: f2dc366f
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
    float uCrunch;
    int uSteps;
    float uStepTime;
    float uHold;
    float uBlock;
    float uChroma;
    float uMosquito;
    char _m20_pad[4];
    packed_float3 uBackdrop;
    float uBackdropAlpha;
};

struct flair_needs_more_jpeg_frag_out
{
    float4 flair_FragColor [[color(0)]];
};

static inline __attribute__((always_inline))
float4 overBackdrop(thread const float4& s, constant FlairUniforms& _99)
{
    float3 colour = fast::min(s.xyz, float3(s.w)) + ((float3(_99.uBackdrop) * _99.uBackdropAlpha) * (1.0 - s.w));
    float alpha = s.w + (_99.uBackdropAlpha * (1.0 - s.w));
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
float4 pictureRGBA(texture2d<float> tex, sampler texSmplr, thread const float2& uv, constant FlairUniforms& _99)
{
    float4 _243;
    if (int2(tex.get_width(), tex.get_height()).x > 1)
    {
        float4 param = tex.sample(texSmplr, uv);
        _243 = overBackdrop(param, _99);
    }
    else
    {
        float2 param_1 = fract(uv);
        _243 = float4(testCard(param_1), 1.0);
    }
    return _243;
}

static inline __attribute__((always_inline))
float3 picture(texture2d<float> tex, sampler texSmplr, thread const float2& uv, constant FlairUniforms& _99)
{
    float2 param = uv;
    return pictureRGBA(tex, texSmplr, param, _99).xyz;
}

static inline __attribute__((always_inline))
float3 toYCC(thread const float3& c)
{
    return float3(dot(c, float3(0.2989999949932098388671875, 0.58700001239776611328125, 0.114000000059604644775390625)), dot(c, float3(-0.16869999468326568603515625, -0.3312999904155731201171875, 0.5)), dot(c, float3(0.5, -0.4187000095844268798828125, -0.081299997866153717041015625)));
}

static inline __attribute__((always_inline))
float2 hash22(thread const float2& p)
{
    float3 p3 = fract(p.xyx * float3(0.103100001811981201171875, 0.10300000011920928955078125, 0.097300000488758087158203125));
    p3 += float3(dot(p3, p3.yzx + float3(33.3300018310546875)));
    return fract((p3.xx + p3.yz) * p3.zy);
}

static inline __attribute__((always_inline))
float3 fromYCC(thread const float3& c)
{
    return float3(c.x + (1.401999950408935546875 * c.z), (c.x - (0.34409999847412109375 * c.y)) - (0.71410000324249267578125 * c.z), c.x + (1.77199995517730712890625 * c.y));
}

static inline __attribute__((always_inline))
void mainImage(thread float4& fragColor, thread const float2& fragCoord, constant FlairUniforms& _99, texture2d<float> uImage, sampler uImageSmplr)
{
    float2 uv = fragCoord / float2(_99.iResolution[0], _99.iResolution[1]);
    float steps = float(_99.uSteps);
    float t = mod(_99.iTime, (0.800000011920928955078125 + (steps * _99.uStepTime)) + _99.uHold) - 0.800000011920928955078125;
    float _350;
    if (t < 0.0)
    {
        _350 = 0.0;
    }
    else
    {
        _350 = (fast::min(floor(t / _99.uStepTime) + 1.0, steps) / steps) * _99.uCrunch;
    }
    float q = _350;
    float2 param = uv;
    float4 pic = pictureRGBA(uImage, uImageSmplr, param, _99);
    if (q <= 0.0)
    {
        fragColor = pic;
        return;
    }
    float b = _99.uBlock;
    float2 cell = floor(fragCoord / float2(b));
    float2 f = fract(fragCoord / float2(b));
    float2 org = cell * b;
    float2 param_1 = (org + (float2(0.25) * b)) / float2(_99.iResolution[0], _99.iResolution[1]);
    float3 s00 = picture(uImage, uImageSmplr, param_1, _99);
    float2 param_2 = (org + (float2(0.75, 0.25) * b)) / float2(_99.iResolution[0], _99.iResolution[1]);
    float3 s10 = picture(uImage, uImageSmplr, param_2, _99);
    float2 param_3 = (org + (float2(0.25, 0.75) * b)) / float2(_99.iResolution[0], _99.iResolution[1]);
    float3 s01 = picture(uImage, uImageSmplr, param_3, _99);
    float2 param_4 = (org + (float2(0.75) * b)) / float2(_99.iResolution[0], _99.iResolution[1]);
    float3 s11 = picture(uImage, uImageSmplr, param_4, _99);
    float2 w = (f - float2(0.25)) * 2.0;
    float3 bilin = mix(mix(s00, s10, float3(w.x)), mix(s01, s11, float3(w.x)), float3(w.y));
    float3 mean = (((s00 + s10) + s01) + s11) * 0.25;
    float3 low = mix(bilin, mean, float3(smoothstep(0.5, 1.0, q) * 0.75));
    float3 param_5 = fast::clamp(mix(pic.xyz, low, float3(smoothstep(0.0, 0.4000000059604644775390625, q))), float3(0.0), float3(1.0));
    float3 ycc = toYCC(param_5);
    float levels = mix(48.0, 7.0, q);
    ycc.x = floor((ycc.x * levels) + 0.5) / levels;
    float cb = b * 2.0;
    float2 ccell = floor((fragCoord - float2(((_99.uChroma * q) * b) * 1.5, 0.0)) / float2(cb));
    float2 param_6 = ((ccell * cb) + float2(cb * 0.5)) / float2(_99.iResolution[0], _99.iResolution[1]);
    float3 param_7 = picture(uImage, uImageSmplr, param_6, _99);
    float2 chroma = toYCC(param_7).yz;
    float2 cbcr = mix(ycc.yz, chroma, float2(_99.uChroma * smoothstep(0.100000001490116119384765625, 0.60000002384185791015625, q)));
    float clevels = mix(64.0, 6.0, q * _99.uChroma);
    cbcr = (floor((cbcr * clevels) + float2(0.5)) / float2(clevels)) * (1.0 + (0.3499999940395355224609375 * q));
    float3 param_8 = s00;
    float3 param_9 = s10;
    float3 param_10 = s01;
    float3 param_11 = s11;
    float4 lum = float4(toYCC(param_8).x, toYCC(param_9).x, toYCC(param_10).x, toYCC(param_11).x);
    float edge = fast::max(fast::max(lum.x, lum.y), fast::max(lum.z, lum.w)) - fast::min(fast::min(lum.x, lum.y), fast::min(lum.z, lum.w));
    float2 param_12 = cell + float2(floor(q * 16.0) * 13.0);
    float2 h = hash22(param_12);
    float2 freq = floor(float2(2.0) + (h * 5.0));
    float basis = cos((3.141590118408203125 * freq.x) * f.x) * cos((3.141590118408203125 * freq.y) * f.y);
    ycc.x += ((((basis * edge) * _99.uMosquito) * q) * 0.449999988079071044921875);
    cbcr += ((h - float2(0.5)) * ((((basis * edge) * _99.uMosquito) * q) * 0.119999997317790985107421875));
    float3 param_13 = float3(ycc.x, cbcr);
    fragColor = float4(fast::clamp(fromYCC(param_13), float3(0.0), float3(1.0)), pic.w);
}

fragment flair_needs_more_jpeg_frag_out flair_needs_more_jpeg_frag(constant FlairUniforms& _99 [[buffer(0)]], texture2d<float> uImage [[texture(1)]], sampler uImageSmplr [[sampler(1)]], float4 gl_FragCoord [[position]])
{
    flair_needs_more_jpeg_frag_out out = {};
    float4 flair_color = float4(0.0, 0.0, 0.0, 1.0);
    float _727;
    if (_99.flair_flipY > 0.5)
    {
        _727 = _99.iResolution[1u] - gl_FragCoord.y;
    }
    else
    {
        _727 = gl_FragCoord.y;
    }
    float2 flair_coord = float2(gl_FragCoord.x, _727);
    float2 param_1 = flair_coord;
    float4 param;
    mainImage(param, param_1, _99, uImage, uImageSmplr);
    flair_color = param;
    out.flair_FragColor = flair_color;
    return out;
}

