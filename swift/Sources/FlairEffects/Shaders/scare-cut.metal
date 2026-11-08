// flair-metal-hash: 69c2ad3f
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
    packed_float3 uTint;
    float uFlash;
    float uPunch;
    float uShake;
    float uCycle;
    uint uAnimate;
    float uProgress;
    char _m20_pad[12];
    packed_float3 uBackdrop;
    float uBackdropAlpha;
};

struct flair_scare_cut_frag_out
{
    float4 flair_FragColor [[color(0)]];
};

static inline __attribute__((always_inline))
float2 hash22(thread const float2& p)
{
    float3 p3 = fract(p.xyx * float3(0.103100001811981201171875, 0.10300000011920928955078125, 0.097300000488758087158203125));
    p3 += float3(dot(p3, p3.yzx + float3(33.3300018310546875)));
    return fract((p3.xx + p3.yz) * p3.zy);
}

static inline __attribute__((always_inline))
float4 overBackdrop(thread const float4& s, constant FlairUniforms& _101)
{
    float3 colour = fast::min(s.xyz, float3(s.w)) + ((float3(_101.uBackdrop) * _101.uBackdropAlpha) * (1.0 - s.w));
    float alpha = s.w + (_101.uBackdropAlpha * (1.0 - s.w));
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
float4 pictureRGBA(texture2d<float> tex, sampler texSmplr, thread const float2& uv, constant FlairUniforms& _101)
{
    float4 _320;
    if (int2(tex.get_width(), tex.get_height()).x > 1)
    {
        float4 param = tex.sample(texSmplr, uv);
        _320 = overBackdrop(param, _101);
    }
    else
    {
        float2 param_1 = fract(uv);
        _320 = float4(testCard(param_1), 1.0);
    }
    return _320;
}

static inline __attribute__((always_inline))
float2 fitCoverUV(texture2d<float> tex, sampler texSmplr, thread const float2& uv, constant FlairUniforms& _101)
{
    int2 ts = int2(tex.get_width(), tex.get_height());
    bool _248 = ts.x <= 1;
    bool _255;
    if (!_248)
    {
        _255 = ts.y <= 1;
    }
    else
    {
        _255 = _248;
    }
    bool _263;
    if (!_255)
    {
        _263 = _101.iResolution[0u] <= 0.0;
    }
    else
    {
        _263 = _255;
    }
    bool _270;
    if (!_263)
    {
        _270 = _101.iResolution[1u] <= 0.0;
    }
    else
    {
        _270 = _263;
    }
    if (_270)
    {
        return uv;
    }
    float boxAspect = _101.iResolution[0u] / _101.iResolution[1u];
    float texAspect = float(ts.x) / float(ts.y);
    float2 _293;
    if (boxAspect > texAspect)
    {
        _293 = float2(1.0, texAspect / boxAspect);
    }
    else
    {
        _293 = float2(boxAspect / texAspect, 1.0);
    }
    float2 scale = _293;
    return ((uv - float2(0.5)) * scale) + float2(0.5);
}

static inline __attribute__((always_inline))
float4 pictureCoverRGBA(texture2d<float> tex, sampler texSmplr, thread const float2& uv, constant FlairUniforms& _101)
{
    float2 param = uv;
    float2 param_1 = fitCoverUV(tex, texSmplr, param, _101);
    return pictureRGBA(tex, texSmplr, param_1, _101);
}

static inline __attribute__((always_inline))
float3 pictureCover(texture2d<float> tex, sampler texSmplr, thread const float2& uv, constant FlairUniforms& _101)
{
    float2 param = uv;
    return pictureCoverRGBA(tex, texSmplr, param, _101).xyz;
}

static inline __attribute__((always_inline))
void mainImage(thread float4& fragColor, thread const float2& fragCoord, constant FlairUniforms& _101, texture2d<float> uImage, sampler uImageSmplr, texture2d<float> uScare, sampler uScareSmplr)
{
    float2 uv = fragCoord / float2(_101.iResolution[0], _101.iResolution[1]);
    float _365;
    if (_101.uAnimate != 0u)
    {
        _365 = mod(_101.iTime, _101.uCycle);
    }
    else
    {
        _365 = _101.uProgress * _101.uCycle;
    }
    float T = _365;
    float hit = 0.60000002384185791015625 * _101.uCycle;
    float dt = T - hit;
    float after = step(0.0, dt);
    float zoom = (1.0 + ((0.039999999105930328369140625 * smoothstep(0.0, hit, T)) * (1.0 - after))) + (((after * _101.uPunch) * 0.25) * exp((-fast::max(dt, 0.0)) * 5.0));
    float2 param = float2(floor(T * 30.0), 3.0);
    float2 shake = ((((hash22(param) - float2(0.5)) * after) * 0.0500000007450580596923828125) * _101.uShake) * exp((-fast::max(dt, 0.0)) * 3.5);
    float2 st = (float2(0.5) + ((uv - float2(0.5)) / float2(zoom))) + shake;
    float2 param_1 = st;
    float4 pic = pictureRGBA(uImage, uImageSmplr, param_1, _101);
    float3 col = pic.xyz * (1.0 - (((0.25 * smoothstep(0.300000011920928955078125 * hit, hit, T)) * (1.0 - after)) * smoothstep(0.20000000298023223876953125, 0.800000011920928955078125, length(uv - float2(0.5)))));
    float cut = after * step(dt, 0.100000001490116119384765625);
    float2 param_2 = (float2(0.5) + ((uv - float2(0.5)) / float2(1.14999997615814208984375))) + shake;
    float l = dot(pictureCover(uScare, uScareSmplr, param_2, _101), float3(0.2125999927520751953125, 0.715200006961822509765625, 0.072200000286102294921875));
    float3 scare = mix(float3(0.0199999995529651641845703125), float3(_101.uTint), float3(smoothstep(0.25, 0.75, l))) * mix(0.5, 1.0, _101.uFlash);
    col = mix(col, scare, float3(cut));
    fragColor = float4(col, fast::max(pic.w, cut));
}

fragment flair_scare_cut_frag_out flair_scare_cut_frag(constant FlairUniforms& _101 [[buffer(0)]], texture2d<float> uImage [[texture(1)]], texture2d<float> uScare [[texture(2)]], sampler uImageSmplr [[sampler(1)]], sampler uScareSmplr [[sampler(2)]], float4 gl_FragCoord [[position]])
{
    flair_scare_cut_frag_out out = {};
    float4 flair_color = float4(0.0, 0.0, 0.0, 1.0);
    float _550;
    if (_101.flair_flipY > 0.5)
    {
        _550 = _101.iResolution[1u] - gl_FragCoord.y;
    }
    else
    {
        _550 = gl_FragCoord.y;
    }
    float2 flair_coord = float2(gl_FragCoord.x, _550);
    float2 param_1 = flair_coord;
    float4 param;
    mainImage(param, param_1, _101, uImage, uImageSmplr, uScare, uScareSmplr);
    flair_color = param;
    out.flair_FragColor = flair_color;
    return out;
}

